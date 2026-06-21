import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const DevicePhotos = ({ photos = [], onChange, maxPhotos = 5, authHeader }) => {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

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
      const isUnder10MB = file.size <= 10 * 1024 * 1024;
      
      if (!isValid) {
        toast.error(`${file.name} no es una imagen válida`);
        return false;
      }
      if (!isUnder10MB) {
        toast.error(`${file.name} es muy grande (máx 10MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    toast.info(`Subiendo ${validFiles.length} foto(s) a Cloudinary...`);

    try {
      const uploadedUrls = await Promise.all(
        validFiles.map(file => uploadToCloudinary(file))
      );

      onChange([...photos, ...uploadedUrls]);
      toast.success(`${validFiles.length} foto(s) subida(s) exitosamente`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Error al subir fotos. Intenta nuevamente.');
    } finally {
      setUploading(false);
    }
  };

  const uploadToCloudinary = async (file) => {
    // Get signature from backend
    const sigResponse = await axios.get(`${API}/api/cloudinary/signature`, {
      headers: authHeader,
      params: {
        resource_type: 'image',
        folder: 'repairs'
      }
    });

    const { signature, timestamp, cloud_name, api_key, folder } = sigResponse.data;

    // Upload to Cloudinary
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', api_key);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', folder);

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    if (!uploadResponse.ok) {
      throw new Error('Cloudinary upload failed');
    }

    const result = await uploadResponse.json();
    return result.secure_url; // Return the URL
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
          disabled={photos.length >= maxPhotos || uploading}
          className="flex-1"
          data-testid="upload-photo-button"
        >
          <Upload size={18} className="mr-2" />
          {uploading ? 'Subiendo...' : 'Subir Fotos'}
        </Button>
        
        <Button
          type="button"
          variant="outline"
          onClick={() => cameraInputRef.current?.click()}
          disabled={photos.length >= maxPhotos || uploading}
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
        disabled={uploading}
      />
      
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
        disabled={uploading}
      />

      {photos.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-700">
              {photos.length} de {maxPhotos} fotos
            </p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800 border border-green-200">
                ☁️ Cloudinary
              </span>
              <p className="text-xs text-zinc-500">
                Almacenamiento en la nube
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photos.map((photoUrl, index) => (
              <div
                key={index}
                className="relative group rounded-lg overflow-hidden border-2 border-zinc-200 hover:border-blue-400 transition-colors"
                data-testid={`photo-preview-${index}`}
              >
                <img
                  src={photoUrl}
                  alt={`Foto del equipo ${index + 1}`}
                  className="w-full h-32 object-cover"
                  loading="lazy"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  data-testid={`remove-photo-${index}`}
                  disabled={uploading}
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
          <strong>Tip:</strong> Las fotos se suben a Cloudinary (CDN global) para carga rápida y almacenamiento seguro. Máximo 10MB por foto.
        </p>
      </div>
    </div>
  );
};

export default DevicePhotos;
