import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crop, RotateCcw } from 'lucide-react';

export default function CropModal({ open, onOpenChange, imageUrl, imageDimensions, onSubmit }) {
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  // Crop region in percentage (0-100) of displayed image
  const [crop, setCrop] = useState({ x: 25, y: 25, width: 50, height: 50 });

  // Reset crop when modal opens
  useEffect(() => {
    if (open) {
      setCrop({ x: 25, y: 25, width: 50, height: 50 });
      setError('');
      setImageLoaded(false);
    }
  }, [open]);

  const handleImageLoad = (e) => {
    setImageLoaded(true);
    setDisplaySize({ width: e.target.naturalWidth, height: e.target.naturalHeight });
  };

  // Convert percentage crop to actual pixel values
  const getCropPixels = useCallback(() => {
    if (!imageDimensions) return null;
    const { width: iw, height: ih } = imageDimensions;
    return {
      x: Math.round((crop.x / 100) * iw),
      y: Math.round((crop.y / 100) * ih),
      width: Math.round((crop.width / 100) * iw),
      height: Math.round((crop.height / 100) * ih),
    };
  }, [crop, imageDimensions]);

  const getRelativePos = useCallback((e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.querySelector('img')?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  const handleMouseDown = useCallback((e, action) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getRelativePos(e);
    setDragStart({ x: pos.x - crop.x, y: pos.y - crop.y, cropSnapshot: { ...crop } });
    if (action === 'move') setDragging(true);
    if (action === 'resize') setResizing(true);
  }, [crop, getRelativePos]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging && !resizing) return;
    const pos = getRelativePos(e);

    if (dragging) {
      const newX = clamp(pos.x - dragStart.x, 0, 100 - crop.width);
      const newY = clamp(pos.y - dragStart.y, 0, 100 - crop.height);
      setCrop(prev => ({ ...prev, x: newX, y: newY }));
    }

    if (resizing) {
      const newW = clamp(pos.x - crop.x, 5, 100 - crop.x);
      const newH = clamp(pos.y - crop.y, 5, 100 - crop.y);
      setCrop(prev => ({ ...prev, width: newW, height: newH }));
    }
  }, [dragging, resizing, dragStart, crop, getRelativePos]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    setResizing(false);
  }, []);

  useEffect(() => {
    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, resizing, handleMouseMove, handleMouseUp]);

  const handleReset = () => {
    setCrop({ x: 25, y: 25, width: 50, height: 50 });
  };

  const handleSubmit = async () => {
    const pixels = getCropPixels();
    if (!pixels || pixels.width < 1 || pixels.height < 1) {
      setError('Invalid crop area');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit(pixels);
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'Crop failed');
    } finally {
      setLoading(false);
    }
  };

  const pixels = getCropPixels();

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5" />
            Crop Image
          </DialogTitle>
          <DialogDescription>
            Drag the crop area to position it. Drag the bottom-right corner to resize.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Image with crop overlay */}
        <div
          ref={containerRef}
          className="relative select-none overflow-hidden rounded-lg bg-muted/50 border"
          style={{ cursor: dragging ? 'grabbing' : 'default' }}
        >
          <img
            src={imageUrl}
            alt="Crop preview"
            className="w-full h-auto block"
            draggable={false}
            onLoad={handleImageLoad}
            style={{ maxHeight: '60vh', objectFit: 'contain' }}
          />

          {imageLoaded && (
            <>
              {/* Dark overlay outside crop area */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(to right,
                    rgba(0,0,0,0.55) ${crop.x}%,
                    transparent ${crop.x}%,
                    transparent ${crop.x + crop.width}%,
                    rgba(0,0,0,0.55) ${crop.x + crop.width}%)`,
                }}
              />
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${crop.x}%`,
                  top: 0,
                  width: `${crop.width}%`,
                  height: `${crop.y}%`,
                  background: 'rgba(0,0,0,0.55)',
                }}
              />
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y + crop.height}%`,
                  width: `${crop.width}%`,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.55)',
                }}
              />

              {/* Crop selection area */}
              <div
                className="absolute border-2 border-white/90 shadow-lg"
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.width}%`,
                  height: `${crop.height}%`,
                  cursor: dragging ? 'grabbing' : 'grab',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
              >
                {/* Grid lines (rule of thirds) */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute left-1/3 top-0 bottom-0 w-[1px] bg-white/30" />
                  <div className="absolute left-2/3 top-0 bottom-0 w-[1px] bg-white/30" />
                  <div className="absolute top-1/3 left-0 right-0 h-[1px] bg-white/30" />
                  <div className="absolute top-2/3 left-0 right-0 h-[1px] bg-white/30" />
                </div>

                {/* Corner handles */}
                <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white" />
                <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white" />
                <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white" />

                {/* Resize handle (bottom-right corner) */}
                <div
                  className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-white bg-white/20 rounded-br-sm"
                  style={{ cursor: 'nwse-resize' }}
                  onMouseDown={(e) => handleMouseDown(e, 'resize')}
                />
              </div>
            </>
          )}
        </div>

        {/* Crop dimensions info */}
        {pixels && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Selection: <strong>{pixels.width} × {pixels.height}</strong> px
              {' '}at ({pixels.x}, {pixels.y})
            </span>
            <span>
              Original: {imageDimensions?.width} × {imageDimensions?.height} px
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" type="button" onClick={handleReset} disabled={loading}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !imageLoaded}>
            <Crop className="h-4 w-4 mr-1" />
            {loading ? 'Cropping…' : 'Crop Image'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
