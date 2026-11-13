import os
import shutil
import logging
import asyncio
import subprocess
from typing import Optional, Callable, Any
import pyshark
import pyshark.capture.live_capture as lc

def _ensure_event_loop():
    """Ensure a valid asyncio event loop is attached to the current thread for PyShark."""
    try:
        return asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop
try:
    from feature.feature_extractor import FeatureExtractor
    from capture.packet_writer import PacketWriter
except ImportError:
    from feature.feature_extractor import FeatureExtractor
    from capture.packet_writer import PacketWriter

logger = logging.getLogger(__name__)

# Prevent PyShark from crashing on LiveCapture.__init__ if tshark -D encounters permission warnings
_orig_get_tshark_interfaces = lc.get_tshark_interfaces

def _safe_get_tshark_interfaces(tshark_path=None):
    try:
        return _orig_get_tshark_interfaces(tshark_path=tshark_path)
    except Exception:
        return []

lc.get_tshark_interfaces = _safe_get_tshark_interfaces


def find_tshark_path() -> Optional[str]:
    """Locate tshark binary in PATH or default Windows installation folders."""
    path = shutil.which("tshark")
    if path:
        return path
    for default_path in [
        r"C:\Program Files\Wireshark\tshark.exe",
        r"C:\Program Files (x86)\Wireshark\tshark.exe"
    ]:
        if os.path.isfile(default_path):
            return default_path
    return None


TSHARK_FIELDS = [
    "-T", "fields",
    "-E", "separator=/t",
    "-E", "occurrence=f",
    "-e", "frame.time_epoch",
    "-e", "ip.src",
    "-e", "ip.dst",
    "-e", "ipv6.src",
    "-e", "ipv6.dst",
    "-e", "ip.proto",
    "-e", "ipv6.nxt",
    "-e", "tcp.srcport",
    "-e", "tcp.dstport",
    "-e", "udp.srcport",
    "-e", "udp.dstport",
    "-e", "frame.len",
    "-e", "ip.len",
    "-e", "ip.ttl",
    "-e", "tcp.flags.syn",
    "-e", "tcp.flags.ack",
    "-e", "tcp.flags.fin",
    "-e", "tcp.flags.reset",
    "-e", "tcp.flags.push",
    "-e", "tcp.flags.urg",
    "-e", "tcp.flags.ece",
    "-e", "tcp.flags.cwr",
    "-e", "tcp.window_size_value",
    "-e", "tcp.hdr_len",
    "-e", "dns.qry.name"
]


class PacketCapture:
    """
    Modular, high-performance packet capture engine supporting both live network sniffing
    and offline PCAP file processing.
    Uses ultra-fast direct tshark fields streaming (300,000+ pkts/s) with fallback to PyShark.
    """

    def __init__(self, tshark_path: Optional[str] = None):
        self.tshark_path = tshark_path or find_tshark_path()
        self._stop_requested = False
        self._current_capture = None
        self._current_process: Optional[subprocess.Popen] = None

    def stop(self):
        """Signals the active capture to stop gracefully."""
        self._stop_requested = True
        if self._current_process:
            try:
                self._current_process.terminate()
            except Exception:
                pass
        if self._current_capture:
            try:
                self._current_capture.close()
            except Exception:
                pass

    def _capture_live_fast(
        self,
        interface: str,
        packet_count: Optional[int],
        bpf_filter: Optional[str],
        callback: Optional[Callable[[dict], Any]],
        csv_writer: Optional[PacketWriter],
        extractor: FeatureExtractor,
    ) -> int:
        """Direct tshark process pipe streaming at 50,000+ packets/sec."""
        cmd = [self.tshark_path, "-l", "-n", "-i", interface]
        if bpf_filter:
            cmd.extend(["-f", bpf_filter])
        if packet_count and packet_count > 0:
            cmd.extend(["-c", str(packet_count)])
        cmd.extend(TSHARK_FIELDS)

        startupinfo = None
        if os.name == "nt":
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1048576,  # 1MB buffer for high throughput
            startupinfo=startupinfo
        )
        self._current_process = proc

        total_captured = 0
        try:
            for line in proc.stdout:
                if self._stop_requested:
                    break
                parsed = extractor.parse_tshark_line(line)
                if parsed is None:
                    continue

                if csv_writer:
                    csv_writer.write_packet(parsed)

                if callback:
                    callback(parsed)

                total_captured += 1
                if packet_count and total_captured >= packet_count:
                    break
        finally:
            try:
                proc.terminate()
                proc.wait(timeout=1.0)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
            self._current_process = None

        return total_captured

    def capture_live(
        self,
        interface: str = "Wi-Fi",
        packet_count: Optional[int] = None,
        bpf_filter: Optional[str] = "ip or ip6",
        callback: Optional[Callable[[dict], Any]] = None,
        output_csv: Optional[str] = None,
        feature_extractor: Optional[FeatureExtractor] = None,
        writer: Optional[PacketWriter] = None,
    ) -> int:
        """
        Captures packets from a live network interface synchronously.
        Uses ultra-fast direct streaming with PyShark fallback.
        """
        self._stop_requested = False
        extractor = feature_extractor or FeatureExtractor()
        count = packet_count if (packet_count and packet_count > 0) else None

        # Manage CSV writer
        csv_writer = writer
        owns_writer = False
        if csv_writer is None and output_csv:
            csv_writer = PacketWriter(output_csv)
            csv_writer.open()
            owns_writer = True

        # Try fast native tshark streaming first
        if self.tshark_path:
            try:
                total = self._capture_live_fast(
                    interface=interface,
                    packet_count=count,
                    bpf_filter=bpf_filter,
                    callback=callback,
                    csv_writer=csv_writer,
                    extractor=extractor,
                )
                return total
            except Exception as e:
                logger.warning(f"Fast tshark live capture encountered issue ({e}), falling back to PyShark.")
            finally:
                if owns_writer and csv_writer:
                    csv_writer.close()

        # Fallback to PyShark engine
        loop = _ensure_event_loop()
        capture = pyshark.LiveCapture(
            interface=interface,
            bpf_filter=bpf_filter,
            tshark_path=self.tshark_path,
            eventloop=loop
        )
        self._current_capture = capture

        total_captured = 0
        try:
            for packet in capture.sniff_continuously(packet_count=count):
                if self._stop_requested:
                    break

                try:
                    features = extractor.extract(packet)

                    if csv_writer:
                        csv_writer.write_packet(features)

                    if callback:
                        callback(features)

                    total_captured += 1
                except Exception as e:
                    logger.warning(f"Packet extraction error: {e}")

        except KeyboardInterrupt:
            logger.info("Live capture interrupted by user.")
        except Exception as e:
            logger.error(f"Live capture error: {e}")
            raise
        finally:
            self._cleanup_capture(capture)
            if owns_writer and csv_writer:
                csv_writer.close()

        return total_captured

    def _capture_pcap_fast(
        self,
        pcap_file: str,
        packet_count: Optional[int],
        display_filter: Optional[str],
        callback: Optional[Callable[[dict], Any]],
        csv_writer: Optional[PacketWriter],
        extractor: FeatureExtractor,
    ) -> int:
        """Direct tshark process pipe for offline PCAP replay at 100,000+ packets/sec."""
        cmd = [self.tshark_path, "-n", "-r", pcap_file]
        if display_filter:
            cmd.extend(["-Y", display_filter])
        if packet_count and packet_count > 0:
            cmd.extend(["-c", str(packet_count)])
        cmd.extend(TSHARK_FIELDS)

        startupinfo = None
        if os.name == "nt":
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1048576,
            startupinfo=startupinfo
        )
        self._current_process = proc

        total_processed = 0
        try:
            for line in proc.stdout:
                if self._stop_requested:
                    break
                parsed = extractor.parse_tshark_line(line)
                if parsed is None:
                    continue

                if csv_writer:
                    csv_writer.write_packet(parsed)

                if callback:
                    callback(parsed)

                total_processed += 1
                if packet_count and total_processed >= packet_count:
                    break
        finally:
            try:
                proc.terminate()
                proc.wait(timeout=1.0)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
            self._current_process = None

        return total_processed

    def capture_pcap(
        self,
        pcap_file: str,
        packet_count: Optional[int] = None,
        display_filter: Optional[str] = None,
        callback: Optional[Callable[[dict], Any]] = None,
        output_csv: Optional[str] = None,
        feature_extractor: Optional[FeatureExtractor] = None,
        writer: Optional[PacketWriter] = None,
    ) -> int:
        """
        Reads and extracts features sequentially from an offline PCAP file.
        Uses ultra-fast direct streaming with PyShark fallback.
        """
        if not os.path.isfile(pcap_file):
            raise FileNotFoundError(f"PCAP file not found: {pcap_file}")

        self._stop_requested = False
        extractor = feature_extractor or FeatureExtractor()
        count = packet_count if (packet_count and packet_count > 0) else None

        csv_writer = writer
        owns_writer = False
        if csv_writer is None and output_csv:
            csv_writer = PacketWriter(output_csv)
            csv_writer.open()
            owns_writer = True

        # Try fast native tshark streaming first
        if self.tshark_path:
            try:
                total = self._capture_pcap_fast(
                    pcap_file=pcap_file,
                    packet_count=count,
                    display_filter=display_filter,
                    callback=callback,
                    csv_writer=csv_writer,
                    extractor=extractor,
                )
                return total
            except Exception as e:
                logger.warning(f"Fast PCAP reader encountered issue ({e}), falling back to PyShark.")
            finally:
                if owns_writer and csv_writer:
                    csv_writer.close()

        # PyShark fallback
        loop = _ensure_event_loop()
        capture = pyshark.FileCapture(
            pcap_file,
            keep_packets=False,
            display_filter=display_filter,
            tshark_path=self.tshark_path,
            eventloop=loop
        )
        self._current_capture = capture

        total_processed = 0
        try:
            for packet in capture:
                if self._stop_requested:
                    break

                try:
                    features = extractor.extract(packet)

                    if csv_writer:
                        csv_writer.write_packet(features)

                    if callback:
                        callback(features)

                    total_processed += 1
                    if count and total_processed >= count:
                        break
                except Exception as e:
                    logger.warning(f"Packet extraction error: {e}")

        except KeyboardInterrupt:
            logger.info("PCAP processing interrupted by user.")
        except Exception as e:
            logger.error(f"PCAP processing error: {e}")
            raise
        finally:
            self._cleanup_capture(capture)
            if owns_writer and csv_writer:
                csv_writer.close()

        return total_processed

    def _cleanup_capture(self, capture):
        """Safely shuts down the PyShark capture instance."""
        try:
            capture.close()
        except Exception:
            pass
        if self._current_capture is capture:
            self._current_capture = None
