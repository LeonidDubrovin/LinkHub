import sharp from 'sharp';

async function generateIcons() {
  try {
    // Generate a clean PNG from SVG
    await sharp('public/icon.svg')
      .resize(512, 512)
      .png()
      .toFile('public/icon-new.png');
      
    console.log('Successfully generated clean PNG');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
}

generateIcons();
