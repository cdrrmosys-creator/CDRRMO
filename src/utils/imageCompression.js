/**
 * Compresses an image file to reduce its size before uploading.
 * It resizes the image so its maximum dimension is `maxWidthOrHeight`
 * and converts it to a JPEG with the specified `quality`.
 * 
 * @param {File} file - The original image file
 * @param {number} maxWidthOrHeight - Maximum width or height
 * @param {number} quality - JPEG quality (0 to 1)
 * @returns {Promise<File>} - A promise that resolves to the compressed File
 */
export async function compressImage(file, maxWidthOrHeight = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    // We only compress images. If it's not an image, just return original.
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
        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas is empty'));
              return;
            }
            // Create a new File from the Blob
            // Ensure we save as JPEG to actually apply the quality compression
            const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpeg";
            const compressedFile = new File([blob], newFileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}
