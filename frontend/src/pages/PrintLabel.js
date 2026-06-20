import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { Wrench } from 'lucide-react';
import './PrintLabel.css';

const API = process.env.REACT_APP_BACKEND_URL;

const PrintLabel = () => {
  const { id } = useParams();
  const [repair, setRepair] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRepair();
  }, [id]);

  const fetchRepair = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/repairs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRepair(response.data);
    } catch (error) {
      console.error('Error al cargar reparación:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repair) {
      // Auto print after 1 second
      setTimeout(() => {
        window.print();
      }, 1000);
    }
  }, [repair]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!repair) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Orden no encontrada</p>
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/public/${repair.ticket_number}`;

  return (
    <div className="print-container">
      <div className="label-page">
        {/* Etiqueta 1 */}
        <div className="label">
          <div className="label-header">
            <div className="label-logo">
              <Wrench size={24} strokeWidth={2} />
              <span className="label-company">ServiceTech</span>
            </div>
            <div className="label-ticket">{repair.ticket_number}</div>
          </div>

          <div className="label-body">
            <div className="label-info">
              <div className="label-field">
                <span className="label-field-title">Cliente:</span>
                <span className="label-field-value">{repair.customer_name}</span>
              </div>
              
              <div className="label-field">
                <span className="label-field-title">Equipo:</span>
                <span className="label-field-value">
                  {repair.device_brand} {repair.device_model}
                </span>
              </div>
              
              <div className="label-field">
                <span className="label-field-title">Falla:</span>
                <span className="label-field-value label-issue">
                  {repair.reported_issue.length > 80 
                    ? repair.reported_issue.substring(0, 80) + '...'
                    : repair.reported_issue
                  }
                </span>
              </div>

              <div className="label-field">
                <span className="label-field-title">Fecha:</span>
                <span className="label-field-value">
                  {new Date(repair.received_date).toLocaleDateString('es-CL')}
                </span>
              </div>
            </div>

            <div className="label-qr">
              <QRCodeSVG 
                value={publicUrl}
                size={120}
                level="M"
                includeMargin={false}
              />
              <p className="label-qr-text">Escanea para ver estado</p>
            </div>
          </div>

          <div className="label-footer">
            <p>🔧 Servicio Técnico Profesional</p>
          </div>
        </div>

        {/* Etiqueta 2 (duplicada para tener 2 por página) */}
        <div className="label">
          <div className="label-header">
            <div className="label-logo">
              <Wrench size={24} strokeWidth={2} />
              <span className="label-company">ServiceTech</span>
            </div>
            <div className="label-ticket">{repair.ticket_number}</div>
          </div>

          <div className="label-body">
            <div className="label-info">
              <div className="label-field">
                <span className="label-field-title">Cliente:</span>
                <span className="label-field-value">{repair.customer_name}</span>
              </div>
              
              <div className="label-field">
                <span className="label-field-title">Equipo:</span>
                <span className="label-field-value">
                  {repair.device_brand} {repair.device_model}
                </span>
              </div>
              
              <div className="label-field">
                <span className="label-field-title">Falla:</span>
                <span className="label-field-value label-issue">
                  {repair.reported_issue.length > 80 
                    ? repair.reported_issue.substring(0, 80) + '...'
                    : repair.reported_issue
                  }
                </span>
              </div>

              <div className="label-field">
                <span className="label-field-title">Fecha:</span>
                <span className="label-field-value">
                  {new Date(repair.received_date).toLocaleDateString('es-CL')}
                </span>
              </div>
            </div>

            <div className="label-qr">
              <QRCodeSVG 
                value={publicUrl}
                size={120}
                level="M"
                includeMargin={false}
              />
              <p className="label-qr-text">Escanea para ver estado</p>
            </div>
          </div>

          <div className="label-footer">
            <p>🔧 Servicio Técnico Profesional</p>
          </div>
        </div>
      </div>

      {/* Botón para cerrar solo visible en pantalla */}
      <div className="no-print" style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        gap: '10px'
      }}>
        <button 
          onClick={() => window.print()}
          style={{
            padding: '12px 24px',
            backgroundColor: '#2563EB',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Imprimir de Nuevo
        </button>
        <button 
          onClick={() => window.close()}
          style={{
            padding: '12px 24px',
            backgroundColor: '#71717A',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default PrintLabel;
