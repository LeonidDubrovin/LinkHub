import sharp from 'sharp';
import fs from 'fs';

async function generateIcon() {
  try {
    const svgBuffer = fs.readFileSync('public/icon.svg');
    await sharp(svgBuffer)
      .resize(256, 256)
      .png()
      .toFile('public/icon.png');
    console.log('Successfully generated public/icon.png');
  } catch (error) {
    console.error('Error generating icon:', error);
  }
}

generateIcon();
