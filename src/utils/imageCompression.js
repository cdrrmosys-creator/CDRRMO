/**
 * Compresses an image file to reduce its size before uploading.
 * It resizes the image so its maximum dimension is `maxWidthOrHeight`,
 * then iteratively lowers JPEG quality until the output is under `maxSizeKB`.
 * 
 * @param {File} file - The original image file
 * @param {number} maxWidthOrHeight - Maximum width or height in pixels
 * @param {number} quality - Starting JPEG quality (0 to 1)
 * @param {number} maxSizeKB - Maximum output file size in kilobytes (default 150)
 * @returns {Promise<File>} - A promise that resolves to the compressed File
 */
export async function compressImage(file, maxWidthOrHeight = 1024, quality = 0.8, maxSizeKB = 150) {
  return new Promise((resolve, reject) => {
    // Only compress images. If it's not an image, return original.
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let { width, height } = img;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidthOrHeight) {
            height = Math.round((height * maxWidthOrHeight) / width);
            width = maxWidthOrHeight;
          }
        } else {
          if (height > maxWidthOrHeight) {
            width = Math.round((width * maxWidthOrHeight) / height);
            height = maxWidthOrHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const maxSizeBytes = maxSizeKB * 1024;
        let currentQuality = quality;
        const MIN_QUALITY = 0.1;

        // Recursive function to try compressing at decreasing quality levels
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Canvas is empty'));
                return;
              }

              // If the blob is under the size limit OR we've hit minimum quality, accept it
              if (blob.size <= maxSizeBytes || currentQuality <= MIN_QUALITY) {
                const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpeg";
                const compressedFile = new File([blob], newFileName, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                // Reduce quality by 0.1 and try again
                currentQuality = Math.max(currentQuality - 0.1, MIN_QUALITY);
                tryCompress();
              }
            },
            'image/jpeg',
            currentQuality
          );
        };

        tryCompress();
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}
