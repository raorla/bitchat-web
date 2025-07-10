/**
 * Placeholder icons as data URLs
 * These will be replaced by proper PNG icons when available
 */

// Generate a simple icon programmatically
function generateIcon(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    
    // Green border
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = Math.max(2, size / 64);
    ctx.strokeRect(ctx.lineWidth/2, ctx.lineWidth/2, size - ctx.lineWidth, size - ctx.lineWidth);
    
    // Chat bubble
    const bubbleSize = size * 0.6;
    const bubbleX = (size - bubbleSize) / 2;
    const bubbleY = size * 0.2;
    
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = Math.max(1, size / 128);
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleSize, bubbleSize * 0.7, size / 32);
    ctx.stroke();
    
    // Text lines in bubble
    const lineY1 = bubbleY + bubbleSize * 0.2;
    const lineY2 = bubbleY + bubbleSize * 0.35;
    const lineY3 = bubbleY + bubbleSize * 0.5;
    
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = Math.max(1, size / 256);
    
    ctx.beginPath();
    ctx.moveTo(bubbleX + bubbleSize * 0.1, lineY1);
    ctx.lineTo(bubbleX + bubbleSize * 0.9, lineY1);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(bubbleX + bubbleSize * 0.1, lineY2);
    ctx.lineTo(bubbleX + bubbleSize * 0.7, lineY2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(bubbleX + bubbleSize * 0.1, lineY3);
    ctx.lineTo(bubbleX + bubbleSize * 0.5, lineY3);
    ctx.stroke();
    
    // Network nodes
    const nodeSize = Math.max(2, size / 64);
    const networkY = size * 0.85;
    
    ctx.fillStyle = '#00ff00';
    
    // Center node
    ctx.beginPath();
    ctx.arc(size / 2, networkY, nodeSize, 0, 2 * Math.PI);
    ctx.fill();
    
    // Side nodes
    ctx.beginPath();
    ctx.arc(size * 0.3, networkY, nodeSize * 0.7, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(size * 0.7, networkY, nodeSize * 0.7, 0, 2 * Math.PI);
    ctx.fill();
    
    // Connections
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = Math.max(1, size / 256);
    
    ctx.beginPath();
    ctx.moveTo(size / 2, networkY);
    ctx.lineTo(size * 0.3, networkY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(size / 2, networkY);
    ctx.lineTo(size * 0.7, networkY);
    ctx.stroke();
    
    return canvas.toDataURL('image/png');
}

// Generate and save icons
const iconSizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];

iconSizes.forEach(size => {
    const iconData = generateIcon(size);
    
    // Create blob and download
    fetch(iconData)
        .then(res => res.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `icon-${size}x${size}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
});

console.log('Generated placeholder icons');
