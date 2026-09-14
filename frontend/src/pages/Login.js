import React, { useState } from 'react';
import EmailCodeForm from './EmailCodeForm';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Wrench, Mail, Lock, User, UserPlus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const Login = ({ initialTab = 'login' }) => {
  const [tab, setTab] = useState(initialTab);
  const [challenge, setChallenge] = useState(null);
  const [recovering, setRecovering] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ 
    email: '', 
    password: '', 
    name: '', 
    company_name: ''
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginData.email, loginData.password);
      toast.success('¡Bienvenido!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(registerData);
      setChallenge({ ...registerData });
      toast.success('Revisa tu correo para verificar la cuenta.');
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (!error.response) {
        toast.error('No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.');
      } else if (typeof detail === 'string') {
        toast.error(detail);
      } else if (Array.isArray(detail)) {
        const labels = { email: 'Email', password: 'Contraseña', name: 'Nombre', company_name: 'Nombre del negocio' };
        const messages = detail.map(item => {
          const field = item.loc?.[item.loc.length - 1];
          if (field === 'email') return 'Introduce un email válido';
          if (field === 'password' && item.type === 'string_too_short') return 'La contraseña debe tener al menos 10 caracteres';
          if (field === 'password' && item.type === 'string_too_long') return 'La contraseña no puede superar 72 caracteres';
          return (labels[field] || 'Datos del registro') + ': ' + (item.msg || 'valor no válido');
        });
        toast.error(messages.join('. ') || 'Revisa los datos del registro.');
      } else {
        toast.error('El servidor no pudo completar el registro. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div 
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{ 
          backgroundImage: 'url(https://images.pexels.com/photos/13625784/pexels-photo-13625784.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)' 
        }}
      >
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="flex items-center gap-3 mb-6">
            <Wrench size={40} strokeWidth={1.5} />
            <h1 className="text-4xl font-bold tracking-tight">iFixFlow</h1>
          </div>
          <p className="text-xl text-zinc-200 max-w-md leading-relaxed">
            Sistema de gestión para servicios técnicos de telefonía. Controla reparaciones, inventario y clientes en un solo lugar.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Wrench size={32} className="text-blue-600" />
              <h1 className="text-3xl font-bold tracking-tight">iFixFlow</h1>
            </div>
            <p className="text-sm text-zinc-600">Sistema de Gestión</p>
          </div>

          {(challenge || recovering) ? <EmailCodeForm registration={challenge} onBack={() => { setChallenge(null); setRecovering(false); }} onDone={email => { setChallenge(null); setRecovering(false); setRegisterData({email: '', password: '', name: '', company_name: ''}); setLoginData({ email, password: '' }); setTab('login'); }} /> : <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login" data-testid="login-tab">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="register" data-testid="register-tab">Registrarse</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email" className="text-sm font-medium text-zinc-900">Email</Label>
                  <div className="mt-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="usuario@ejemplo.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="pl-10 border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                      data-testid="login-email-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="login-password" className="text-sm font-medium text-zinc-900">Contraseña</Label>
                  <div className="mt-1 relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="pl-10 border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                      data-testid="login-password-input"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium mt-6"
                  data-testid="login-submit-button"
                >
                  {loading ? 'Iniciando...' : 'Iniciar Sesión'}
                </Button>

                <Button type="button" variant="link" className="w-full" onClick={() => setRecovering(true)}>¿Olvidaste tu contraseña?</Button>
                <p className="text-center text-sm text-zinc-600 mt-4">
                  ¿No tienes una cuenta?{' '}
                  <a href="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
                    Registrarse
                  </a>
                </p>


              </form>
            </TabsContent>

            <TabsContent value="register">
              <p className="text-sm text-zinc-600 mb-4">Un mes de prueba gratis. Después, $10.000 CLP al mes por negocio.</p>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="register-name" className="text-sm font-medium text-zinc-900">Nombre Completo</Label>
                  <div className="mt-1 relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Juan Pérez"
                      value={registerData.name}
                      onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                      className="pl-10 border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                      data-testid="register-name-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="register-email" className="text-sm font-medium text-zinc-900">Email</Label>
                  <div className="mt-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="usuario@ejemplo.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      className="pl-10 border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                      data-testid="register-email-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="register-password" className="text-sm font-medium text-zinc-900">Contraseña</Label>
                  <div className="mt-1 relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                      id="register-password"
                      minLength={10}
                      maxLength={72}
                      type="password"
                      placeholder="••••••••"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      className="pl-10 border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                      data-testid="register-password-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="register-company">Nombre del negocio</Label>
                  <Input id="register-company" required value={registerData.company_name} onChange={e => setRegisterData({ ...registerData, company_name: e.target.value })} />
                  <p className="text-xs text-zinc-500 mt-2">Crearás la cuenta principal. Después podrás añadir administradores y técnicos en Equipo de trabajo.</p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium mt-6"
                  data-testid="register-submit-button"
                >
                  {loading ? 'Enviando código...' : 'Enviar código de verificación'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>}
        </div>
      </div>
    </div>
  );
};

export default Login;
