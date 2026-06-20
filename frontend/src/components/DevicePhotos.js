import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const DevicePhotos = ({ photos = [], onChange, maxPhotos = 5 }) => {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
  };

  const processFiles = async (files) => {
    if (photos.length + files.length > maxPhotos) {
      toast.error(`Máximo ${maxPhotos} fotos permitidas`);
      return;
    }

    const validFiles = files.filter(file => {
      const isValid = file.type.startsWith('image/');
      const isUnder5MB = file.size <= 5 * 1024 * 1024;
      
      if (!isValid) {
        toast.error(`${file.name} no es una imagen válida`);
        return false;
      }
      if (!isUnder5MB) {
        toast.error(`${file.name} es muy grande (máx 5MB)`);
        return false;
      }
      return true;
    });

    const base64Images = await Promise.all(
      validFiles.map(file => convertToBase64(file))
    );

    onChange([...photos, ...base64Images]);
    toast.success(`${validFiles.length} foto(s) agregada(s)`);
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Compress image if needed
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Resize if too large (max 1200px)
          const maxSize = 1200;
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to base64 with compression
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onChange(newPhotos);
    toast.success('Foto eliminada');
  };

  return (
    <div className="space-y-4" data-testid="device-photos-component">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={photos.length >= maxPhotos}
          className="flex-1"
          data-testid="upload-photo-button"
        >
          <Upload size={18} className="mr-2" />
          Subir Fotos
        </Button>
        
        <Button
          type="button"
          variant="outline"
          onClick={() => cameraInputRef.current?.click()}
          disabled={photos.length >= maxPhotos}
          className="flex-1"
          data-testid="take-photo-button"
        >
          <Camera size={18} className="mr-2" />
          Tomar Foto
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />
      
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {photos.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-700">
              {photos.length} de {maxPhotos} fotos
            </p>
            <p className="text-xs text-zinc-500">
              Máximo 5MB por foto
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photos.map((photo, index) => (
              <div
                key={index}
                className="relative group rounded-lg overflow-hidden border-2 border-zinc-200 hover:border-blue-400 transition-colors"
                data-testid={`photo-preview-${index}`}
              >
                <img
                  src={photo}
                  alt={`Foto del equipo ${index + 1}`}
                  className="w-full h-32 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  data-testid={`remove-photo-${index}`}
                >
                  <X size={14} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-1 px-2">
                  Foto {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-zinc-300 rounded-lg p-8 text-center">
          <ImageIcon size={40} className="mx-auto text-zinc-400 mb-3" />
          <p className="text-sm text-zinc-600 mb-1">
            No hay fotos del equipo
          </p>
          <p className="text-xs text-zinc-500">
            Documenta el estado del dispositivo al recibirlo
          </p>
        </div>
      )}

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-xs text-blue-900">
          <strong>Tip:</strong> Toma fotos del equipo completo, pantalla, parte trasera y cualquier daño visible. Esto protege tanto al técnico como al cliente.
        </p>
      </div>
    </div>
  );
};

export default DevicePhotos;
