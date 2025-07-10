#!/bin/bash

# Script to generate PNG icons from SVG
# Requires imagemagick (convert command)

SVG_FILE="icon.svg"
SIZES=(16 20 29 32 40 60 72 76 96 120 128 144 152 167 180 192 256 384 512 1024)

echo "Generating PNG icons from $SVG_FILE..."

# Check if imagemagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick not found. Installing..."
    
    # Try different package managers
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y imagemagick
    elif command -v yum &> /dev/null; then
        sudo yum install -y ImageMagick
    elif command -v brew &> /dev/null; then
        brew install imagemagick
    else
        echo "Please install ImageMagick manually"
        exit 1
    fi
fi

# Generate PNG files
for size in "${SIZES[@]}"; do
    output_file="icon-${size}x${size}.png"
    echo "Generating $output_file..."
    
    convert -background transparent "$SVG_FILE" -resize "${size}x${size}" "$output_file"
    
    if [ $? -eq 0 ]; then
        echo "✓ Generated $output_file"
    else
        echo "✗ Failed to generate $output_file"
    fi
done

echo "Icon generation complete!"

# Create favicons
if [ -f "icon-32x32.png" ]; then
    cp "icon-32x32.png" "../favicon.ico"
    echo "✓ Created favicon.ico"
fi
