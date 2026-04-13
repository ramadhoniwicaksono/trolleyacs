import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Camera, Upload, X, ScanLine, RotateCcw, ImageIcon } from 'lucide-react';

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (value: string) => void;
  title?: string;
  description?: string;
}

type ScanMode = 'choose' | 'camera' | 'upload';

export default function BarcodeScanner({
  open,
  onOpenChange,
  onScan,
  title = 'Scan Barcode',
  description = 'Scan barcode dengan kamera atau upload gambar barcode',
}: BarcodeScannerProps) {
  const [mode, setMode] = useState<ScanMode>('choose');
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'barcode-scanner-container';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup scanner on unmount or when dialog closes
  const stopScanner = useCallback(async () => {
    try {
      if (html5QrCodeRef.current) {
        const state = html5QrCodeRef.current.getState();
        // State 2 = SCANNING, State 3 = PAUSED
        if (state === 2 || state === 3) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
    } catch (err) {
      // Ignore cleanup errors
      console.debug('Scanner cleanup:', err);
    }
    setIsScanning(false);
  }, []);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      stopScanner();
      setMode('choose');
      setScanResult(null);
      setError(null);
    }
  }, [open, stopScanner]);

  // Start camera scanner
  const startCameraScanner = useCallback(async () => {
    setError(null);
    setScanResult(null);
    setIsScanning(true);
    setMode('camera');

    // Wait for DOM to render the container
    await new Promise((resolve) => setTimeout(resolve, 300));

    const container = document.getElementById(scannerContainerId);
    if (!container) {
      setError('Scanner container tidak ditemukan');
      setIsScanning(false);
      return;
    }

    try {
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' }, // Prefer rear camera
        {
          fps: 10,
          qrbox: { width: 280, height: 150 },
          aspectRatio: 1.5,
        },
        (decodedText) => {
          // Success callback
          setScanResult(decodedText);
          // Stop scanning after success
          html5QrCode.stop().then(() => {
            html5QrCode.clear();
            html5QrCodeRef.current = null;
            setIsScanning(false);
          }).catch(() => {
            setIsScanning(false);
          });
        },
        () => {
          // Ignore scan failures (called frequently when no barcode in view)
        }
      );
    } catch (err: any) {
      console.error('Camera error:', err);
      setIsScanning(false);
      if (err?.toString().includes('NotFoundError') || err?.toString().includes('NotAllowedError')) {
        setError('Kamera tidak tersedia atau izin ditolak. Pastikan browser memiliki akses kamera.');
      } else {
        setError(`Gagal membuka kamera: ${err?.message || err}`);
      }
    }
  }, []);

  // Handle image file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setScanResult(null);
    setMode('upload');

    try {
      // Create a temporary scanner instance for file scanning
      const scannerDiv = document.createElement('div');
      scannerDiv.id = 'temp-scanner-' + Date.now();
      scannerDiv.style.display = 'none';
      document.body.appendChild(scannerDiv);

      const html5QrCode = new Html5Qrcode(scannerDiv.id);

      const result = await html5QrCode.scanFile(file, true);
      setScanResult(result);

      html5QrCode.clear();
      document.body.removeChild(scannerDiv);
    } catch (err: any) {
      console.error('File scan error:', err);
      setError('Tidak dapat membaca barcode dari gambar. Pastikan gambar jelas dan berisi barcode yang valid.');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle confirm scanned result
  const handleConfirm = () => {
    if (scanResult) {
      onScan(scanResult);
      onOpenChange(false);
    }
  };

  // Handle retry
  const handleRetry = () => {
    setScanResult(null);
    setError(null);
    if (mode === 'camera') {
      startCameraScanner();
    } else {
      setMode('choose');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-blue-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Selection */}
          {mode === 'choose' && !scanResult && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={startCameraScanner}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200 group"
              >
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <Camera className="w-7 h-7 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm text-gray-800">Buka Kamera</p>
                  <p className="text-xs text-gray-500 mt-1">Scan barcode langsung</p>
                </div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all duration-200 group"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <ImageIcon className="w-7 h-7 text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm text-gray-800">Upload Gambar</p>
                  <p className="text-xs text-gray-500 mt-1">Dari foto barcode</p>
                </div>
              </button>
            </div>
          )}

          {/* Camera Scanner View */}
          {mode === 'camera' && !scanResult && (
            <div className="space-y-3">
              <div
                id={scannerContainerId}
                className="w-full rounded-lg overflow-hidden bg-black min-h-[250px] relative"
              />
              {isScanning && (
                <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  Arahkan kamera ke barcode...
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  stopScanner();
                  setMode('choose');
                }}
                className="w-full"
              >
                <X className="w-4 h-4 mr-2" />
                Batal
              </Button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-3 text-red-600 border-red-300 hover:bg-red-50"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Coba Lagi
              </Button>
            </div>
          )}

          {/* Scan Result */}
          {scanResult && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-emerald-800">Barcode Terdeteksi!</p>
                </div>
                <div className="bg-white rounded-md p-3 border border-emerald-100">
                  <p className="text-lg font-mono font-bold text-gray-900 break-all">{scanResult}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  className="flex-1"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Scan Ulang
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <ScanLine className="w-4 h-4 mr-2" />
                  Gunakan Hasil
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileUpload}
        />
      </DialogContent>
    </Dialog>
  );
}
