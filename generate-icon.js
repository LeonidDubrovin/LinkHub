import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateIcon() {
  try {
    const svgPath = path.join(process.cwd(), 'public', 'icon.svg');
    const pngPath = path.join(process.cwd(), 'public', 'icon.png');
    
    if (!fs.existsSync(svgPath)) {
      console.error('icon.svg not found at', svgPath);
      return;
    }

    const svgBuffer = fs.readFileSync(svgPath);
    await sharp(svgBuffer)
      .resize(256, 256)
      .png({ compressionLevel: 9, adaptiveFiltering: true, force: true })
      .toFile(pngPath);
      
    console.log('Successfully generated public/icon.png');
  } catch (error) {
    console.error('Error generating icon:', error);
    process.exit(1);
  }
}

generateIcon();
