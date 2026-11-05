import { useState } from 'react';
import { useNavigate, Link } from '@/lib/router-compat';
import {
  Mail, Lock, User, ArrowRight, Plane, ShieldCheck, Building2, Loader2,
  Phone, MessageSquare, CheckCircle2, KeyRound,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { DemoAccountPicker } from '@/pages/auth/DemoAccountPicker';
import type { UserRole } from '@/types';

type AuthMethod = 'email' | 'phone' | 'google';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { signIn, signUp, signInWithGoogle, signInWithPhone, verifyPhoneOtp } = useAuth();
  const navigate = useNavigate();

  const [method, setMethod] = useState<AuthMethod>('email');

  // Email form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('traveler');

  // Phone form state
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error);
        setLoading(false);
      } else {
        navigate('/');
      }
    } else {
      if (fullName.trim().length < 2) {
        setError('Please enter your full name');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      const { error, needsConfirmation } = await signUp(email, password, role, fullName);
      if (error) {
        setError(error);
        setLoading(false);
      } else if (needsConfirmation) {
        setInfo('Account created! Check your email and click the confirmation link, then sign in.');
        setLoading(false);
      } else {
        navigate('/');
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error);
      setLoading(false);
    }
    // If successful, browser redirects to Google — no need to setLoading(false)
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (phone.trim().length < 8) {
      setError('Please enter a valid phone number');
      setLoading(false);
      return;
    }

    const { error } = await signInWithPhone(phone.trim());
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      setInfo('A verification code has been sent to your phone. Enter it below to continue.');
      setOtpSent(true);
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (otpCode.trim().length < 4) {
      setError('Please enter the verification code');
      setLoading(false);
      return;
    }

    const { error } = await verifyPhoneOtp(phone.trim(), otpCode.trim());
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  const resetPhone = () => {
    setOtpSent(false);
    setOtpCode('');
    setInfo(null);
    setError(null);
  };

  const methodTabs: { key: AuthMethod; label: string; icon: React.ElementType }[] = [
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'phone', label: 'Phone', icon: Phone },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-[54%] bg-background relative overflow-hidden border-r border-border">
        <div className="absolute inset-0 paper-grid grid-fade" />
        {/* Dashed flight route across the map */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 900" preserveAspectRatio="none" aria-hidden="true">
          <path d="M-20 760 C 180 640, 260 820, 420 600 S 700 380, 840 140" fill="none" stroke="var(--teal-400)" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="6 8" />
          <circle cx="420" cy="600" r="5" fill="var(--amber-400)" />
          <circle cx="420" cy="600" r="11" fill="none" stroke="var(--amber-400)" strokeOpacity="0.5" />
        </svg>

        <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
          <Logo size="lg" />

          <div className="grid gap-10 xl:grid-cols-[1fr_auto] xl:items-center">
            <div className="max-w-lg">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-navy-600">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
                For travelers & travel businesses
              </span>
              <h1 className="mt-6 text-5xl xl:text-6xl font-semibold leading-[1.05] text-navy-900 text-balance">
                Travel lighter.<br />
                Verify <span className="marker">faster.</span><br />
                Arrive ready.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-navy-500">
                Your passport becomes a secure digital travel card — scanned in seconds, checked with one QR at every hotel, airline and tour desk.
              </p>

              <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
                {[
                  { icon: ShieldCheck, title: 'Private', desc: 'Encrypted ID' },
                  { icon: Plane, title: 'Global', desc: 'One card' },
                  { icon: Building2, title: 'Trusted', desc: 'By businesses' },
                ].map((feature) => (
                  <div key={feature.title} className="rounded-xl border border-border bg-card/80 p-3">
                    <feature.icon size={16} className="text-turquoise-600" />
                    <p className="mt-2 text-sm font-semibold text-navy-900">{feature.title}</p>
                    <p className="text-xs text-navy-400">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Boarding-pass preview */}
            <div className="relative hidden xl:block w-72 animate-float">
              <div className="ticket overflow-hidden" style={{ ['--notch-y' as string]: '68%' }}>
                <div className="passport-cover px-5 py-4 flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-80">Boarding pass</span>
                  <Plane size={16} className="text-gold -rotate-45" />
                </div>
                <div className="px-5 pt-4 pb-5">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="eyebrow">From</p>
                      <p className="font-display text-3xl font-semibold text-navy-900">CAI</p>
                    </div>
                    <div className="mb-2 flex flex-1 items-center gap-1 px-3">
                      <span className="flex-1 perforation" />
                      <Plane size={14} className="text-accent-500" />
                      <span className="flex-1 perforation" />
                    </div>
                    <div className="text-right">
                      <p className="eyebrow">To</p>
                      <p className="font-display text-3xl font-semibold text-navy-900">LIS</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div><p className="eyebrow">Gate</p><p className="font-mono text-sm text-navy-800">B12</p></div>
                    <div><p className="eyebrow">Seat</p><p className="font-mono text-sm text-navy-800">14A</p></div>
                    <div><p className="eyebrow">Board</p><p className="font-mono text-sm text-navy-800">09:40</p></div>
                  </div>
                  <div className="my-4 perforation" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="eyebrow">Passenger</p>
                      <p className="text-sm font-semibold text-navy-900">Omar Hassan</p>
                    </div>
                    <span className="stamp"><CheckCircle2 size={12} />Verified</span>
                  </div>
                </div>
              </div>
              <div className="absolute -left-10 -bottom-8 rounded-xl border border-border bg-card px-4 py-3 shadow-lift">
                <p className="text-xs text-navy-400">Identity check</p>
                <p className="font-display text-lg font-semibold text-navy-900">in 2 seconds</p>
              </div>
            </div>
          </div>

          <p className="eyebrow">Passport scan · QR check-in · Bookings · Payments</p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-navy-100/50 relative">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Logo size="md" />
          </div>

          <div className="mb-6">
            <p className="eyebrow mb-2">{mode === 'login' ? 'Sign in' : 'New account'}</p>
            <h2 className="text-4xl font-semibold text-navy-900">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-navy-500 mt-2">
              {mode === 'login'
                ? 'Sign in to access your travel identity dashboard'
                : 'Join ST&ID to start your digital travel identity'}
            </p>
          </div>

          {/* Google sign-in — always visible */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 bg-white text-navy-700 font-medium rounded-xl border border-navy-200 hover:bg-navy-50 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 mb-4"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-5">
            <div className="flex-1 h-px bg-navy-200" />
            <span className="text-xs text-navy-400 font-medium uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-navy-200" />
          </div>

          {/* Method tabs */}
          <div className="flex gap-2 p-1 bg-navy-100 rounded-xl mb-5">
            {methodTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setMethod(tab.key); setError(null); setInfo(null); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  method === tab.key
                    ? 'bg-white text-navy-900 shadow-sm'
                    : 'text-navy-500 hover:text-navy-700'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Email method */}
          {method === 'email' && (
            <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
              {mode === 'register' && (
                <div>
                  <label className="label">Full Name</label>
                  <div className="relative">
                    <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                      className="input pl-11"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input pl-11"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pl-11"
                    required
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="label">I am a...</label>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { value: 'traveler', label: 'Traveler', icon: Plane, desc: 'Personal travel ID' },
                      { value: 'business', label: 'Business', icon: Building2, desc: 'Verify travelers' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRole(opt.value)}
                        className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                          role === opt.value
                            ? 'border-turquoise-500 bg-turquoise-50'
                            : 'border-navy-200 bg-white hover:border-navy-300'
                        }`}
                      >
                        <opt.icon size={20} className={role === opt.value ? 'text-turquoise-600' : 'text-navy-400'} />
                        <p className={`font-semibold mt-2 ${role === opt.value ? 'text-turquoise-700' : 'text-navy-700'}`}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-navy-400">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {info && (
                <div className="p-3 rounded-xl bg-turquoise-50 border border-turquoise-200 text-sm text-turquoise-800 animate-slide-down">
                  {info}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 animate-slide-down">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full text-base py-3"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Phone method */}
          {method === 'phone' && (
            <div className="space-y-5 animate-fade-in">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-5">
                  <div>
                    <label className="label">Phone Number</label>
                    <div className="relative">
                      <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 555 000 0000"
                        className="input pl-11"
                        required
                      />
                    </div>
                    <p className="text-xs text-navy-400 mt-2 flex items-start gap-1.5">
                      <MessageSquare size={12} className="flex-shrink-0 mt-0.5" />
                      Enter your number with country code. We'll send you a one-time verification code via SMS.
                    </p>
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 animate-slide-down">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full text-base py-3"
                  >
                    {loading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <>
                        Send Verification Code
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div className="p-4 rounded-xl bg-turquoise-50 border border-turquoise-200 flex items-start gap-3 animate-slide-down">
                    <CheckCircle2 size={20} className="text-turquoise-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-turquoise-800">Code sent to {phone}</p>
                      <button type="button" onClick={resetPhone} className="text-xs text-turquoise-600 hover:text-turquoise-700 font-medium mt-1">
                        Use a different number
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label">Verification Code</label>
                    <div className="relative">
                      <KeyRound size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400" />
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className="input pl-11 text-center text-lg tracking-[0.3em] font-mono"
                        maxLength={6}
                        required
                      />
                    </div>
                    <p className="text-xs text-navy-400 mt-2">Enter the 6-digit code we sent to your phone.</p>
                  </div>

                  {info && (
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700 animate-slide-down">
                      {info}
                    </div>
                  )}

                  {error && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 animate-slide-down">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full text-base py-3"
                  >
                    {loading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <>
                        Verify & Continue
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {mode === 'register' && !otpSent && (
                <p className="text-xs text-navy-400 text-center">
                  After verification, you'll choose your account type and complete your profile.
                </p>
              )}
            </div>
          )}

          <p className="text-center text-navy-500 mt-6">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <Link to="/register" className="text-turquoise-600 font-semibold hover:text-turquoise-700">
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link to="/login" className="text-turquoise-600 font-semibold hover:text-turquoise-700">
                  Sign in
                </Link>
              </>
            )}
          </p>

          {mode === 'login' && <DemoAccountPicker />}
        </div>
      </div>
    </div>
  );
}
