import sharp from 'sharp';

async function generateIcons() {
  try {
    // Generate a clean PNG from SVG
    await sharp('public/icon.svg')
      .resize(512, 512)
      .png({ compressionLevel: 9, adaptiveFiltering: true, force: true })
      .toFile('public/icon-clean.png');
      
    console.log('Successfully generated clean PNG');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
}

generateIcons();
