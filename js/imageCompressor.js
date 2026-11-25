/**
 * Smart Image Compressor for A4 High-Quality Print
 * Mengompres ukuran file secara signifikan tanpa mengorbankan ketajaman cetak A4 (300+ DPI pada grid 2 kolom).
 */
const ImageCompressor = (() => {
  const MAX_DIMENSION = 1600; // Sangat tajam untuk cetak A4 (setara ~400 DPI untuk sel grid 2 kolom A4)
  const JPEG_QUALITY = 0.85;  // Keseimbangan terbaik antara ukuran file kecil & ketajaman cetak

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  function dataUrlSizeBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1] || '';
    const padding = (base64.match(/=+$/) || [''])[0].length;
    return Math.floor((base64.length * 3) / 4) - padding;
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Gagal memuat gambar: ${file.name}`));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error(`Gagal membaca file: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  async function compressFile(file, options = {}) {
    const maxDim = options.maxDimension || MAX_DIMENSION;
    const quality = options.quality || JPEG_QUALITY;

    const img = await loadImageFromFile(file);
    let { naturalWidth: width, naturalHeight: height } = img;

    // Skala proporsional hanya jika melebihi maxDim
    if (width > maxDim || height > maxDim) {
      if (width >= height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Background putih agar PNG transparan tidak jadi hitam saat dikonversi ke JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const compressedSize = dataUrlSizeBytes(dataUrl);

    return {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      dataUrl,
      originalSize: file.size,
      compressedSize,
      width,
      height
    };
  }

  return {
    compressFile,
    formatBytes
  };
})();
