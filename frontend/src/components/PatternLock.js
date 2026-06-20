import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

const PatternLock = ({ value, onChange, disabled = false }) => {
  const [pattern, setPattern] = useState(value || []);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const gridSize = 3;
  const dots = Array.from({ length: gridSize * gridSize }, (_, i) => i);

  useEffect(() => {
    if (value) {
      setPattern(value);
    }
  }, [value]);

  useEffect(() => {
    drawPattern();
  }, [pattern, currentPosition]);

  const getDotPosition = (dotIndex) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const dotSize = rect.width / gridSize;
    const row = Math.floor(dotIndex / gridSize);
    const col = dotIndex % gridSize;
    return {
      x: col * dotSize + dotSize / 2,
      y: row * dotSize + dotSize / 2,
    };
  };

  const drawPattern = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw lines
    if (pattern.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const firstPos = getDotPosition(pattern[0]);
      if (firstPos) {
        ctx.moveTo(firstPos.x, firstPos.y);

        pattern.forEach((dotIndex, i) => {
          if (i > 0) {
            const pos = getDotPosition(dotIndex);
            if (pos) {
              ctx.lineTo(pos.x, pos.y);
            }
          }
        });

        if (currentPosition && isDrawing) {
          ctx.lineTo(currentPosition.x, currentPosition.y);
        }

        ctx.stroke();
      }

      // Draw dots in pattern order with animation
      pattern.forEach((dotIndex, i) => {
        const pos = getDotPosition(dotIndex);
        if (pos) {
          // Draw connecting line number
          ctx.fillStyle = '#2563EB';
          ctx.font = 'bold 14px IBM Plex Sans';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(i + 1, pos.x, pos.y);
        }
      });
    }
  };

  const getTouchedDot = (x, y) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const dotSize = rect.width / gridSize;
    const threshold = dotSize * 0.4;

    for (let i = 0; i < dots.length; i++) {
      const pos = getDotPosition(i);
      if (pos) {
        const dx = x - pos.x;
        const dy = y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < threshold) {
          return i;
        }
      }
    }
    return null;
  };

  const handleStart = (x, y) => {
    if (disabled) return;
    setIsDrawing(true);
    const dotIndex = getTouchedDot(x, y);
    if (dotIndex !== null) {
      setPattern([dotIndex]);
      onChange([dotIndex]);
    }
  };

  const handleMove = (x, y) => {
    if (!isDrawing || disabled) return;
    setCurrentPosition({ x, y });
    
    const dotIndex = getTouchedDot(x, y);
    if (dotIndex !== null && !pattern.includes(dotIndex)) {
      const newPattern = [...pattern, dotIndex];
      setPattern(newPattern);
      onChange(newPattern);
    }
  };

  const handleEnd = () => {
    setIsDrawing(false);
    setCurrentPosition(null);
  };

  const handleMouseDown = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    handleStart(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseMove = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    handleMove(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    handleStart(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    handleMove(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  const handleReset = () => {
    setPattern([]);
    onChange([]);
    setCurrentPosition(null);
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative w-full aspect-square bg-zinc-50 border-2 border-zinc-200 rounded-lg touch-none select-none"
        style={{ maxWidth: '300px' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEnd}
        data-testid="pattern-lock-grid"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ touchAction: 'none' }}
        />
        
        <div className="grid grid-cols-3 gap-0 w-full h-full p-4">
          {dots.map((dot) => {
            const isSelected = pattern.includes(dot);
            const orderIndex = pattern.indexOf(dot);
            
            return (
              <div key={dot} className="flex items-center justify-center">
                <div
                  className={`w-12 h-12 rounded-full transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-600 scale-110 shadow-lg'
                      : 'bg-zinc-300'
                  }`}
                  data-testid={`pattern-dot-${dot}`}
                >
                  {isSelected && (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {orderIndex + 1}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          {pattern.length > 0
            ? `Patrón: ${pattern.length} puntos conectados`
            : 'Dibuja el patrón de desbloqueo'}
        </p>
        {pattern.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={disabled}
            data-testid="reset-pattern-button"
          >
            <RotateCcw size={16} className="mr-1" />
            Reiniciar
          </Button>
        )}
      </div>

      {pattern.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs text-blue-900 font-medium">
            Patrón guardado: {pattern.join(' → ')}
          </p>
        </div>
      )}
    </div>
  );
};

export default PatternLock;
