import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { AdminDashboard } from './AdminDashboard';
import { CaretakerDashboard } from './CaretakerDashboard';
import { DriverDashboard } from './DriverDashboard';
import { StudentDashboard } from './StudentDashboard';
import { AdminGate } from './AdminGate';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

function MainApp() {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Auth Form State
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'student' | 'driver' | 'caretaker'>('student');

  // Caretaker Specific Fields
  const [phone, setPhone] = useState('');
  const [propertyComplex, setPropertyComplex] = useState('');
  const [unitCount, setUnitCount] = useState('');
  const [caretakerInstitution, setCaretakerInstitution] = useState<'nwu' | 'vut' | 'mix'>('vut');

  // Student Specific Fields
  const [studentPhone, setStudentPhone] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [assignedComplex, setAssignedComplex] = useState('');
  const [studentInstitution, setStudentInstitution] = useState<'nwu' | 'vut'>('vut');
  const [approvedHouses, setApprovedHouses] = useState<string[]>([]);

  // Input Validation Handlers
  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[0-9]/g, '');
    setFullName(val);
  };

  const handlePhoneInput = (value: string, setter: (val: string) => void) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
    setter(digitsOnly);
  };

  // Fetch approved housing complexes for student dropdown
  const fetchApprovedHouses = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('property_complex, role, is_approved')
      .eq('role', 'caretaker')
      .eq('is_approved', true);

    if (!error && data) {
      const complexes = Array.from(new Set(data.map((item: any) => item.property_complex))).filter(Boolean) as string[];
      setApprovedHouses(complexes);
    }
  };

  useEffect(() => {
    fetchApprovedHouses();
  }, []);

  // Listen for Mobile Deep Links (Capacitor App URL Open Event)
  useEffect(() => {
    let deepLinkSub: any;

    async function setupDeepLinkListener() {
      deepLinkSub = await CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
        if (url.includes('querator://login-callback')) {
          const regex = /#(.*)/;
          const match = url.match(regex);
          if (match) {
            const params = new URLSearchParams(match[1]);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            if (access_token && refresh_token) {
              await supabase.auth.setSession({ access_token, refresh_token });
            }
          }
        }
      });
    }

    setupDeepLinkListener();

    return () => {
      if (deepLinkSub) {
        deepLinkSub.remove();
      }
    };
  }, []);

  // Strict session and profile synchronization
  useEffect(() => {
    let isMounted = true;

    async function getInitialSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      
      setSession(session);
      if (session?.user) {
        await fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }
    }

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setSession(session);
      if (session?.user) {
        await fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        setUserProfile(null);
        setNeedsProfileSetup(false);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchUserProfile(userId: string, userEmail: string) {
    setLoading(true);
    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      setNeedsProfileSetup(true);
      setUserProfile(null);
    } else {
      setNeedsProfileSetup(false);
      setUserProfile(data);
    }
    setLoading(false);
  }

  // Handle Email Sign-in & Sign-up with Verification trigger
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'querator://login-callback',
      });
      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        alert('Password recovery link sent! Please check your email inbox.');
        setAuthMode('signin');
      }
      return;
    }

    if (authMode === 'signup') {
      if (selectedRole === 'caretaker' && phone.length !== 10) {
        alert('Phone number must be exactly 10 digits.');
        return;
      }
      if (selectedRole === 'student' && studentPhone.length !== 10) {
        alert('Phone number must be exactly 10 digits.');
        return;
      }

      const metadata: any = {
        full_name: fullName,
        role: selectedRole,
        is_approved: false
      };

      if (selectedRole === 'caretaker') {
        metadata.phone = phone;
        metadata.property_complex = propertyComplex;
        metadata.unit_count = unitCount;
        metadata.institution = caretakerInstitution;
      } else if (selectedRole === 'student') {
        metadata.phone = studentPhone;
        metadata.room_number = roomNumber;
        metadata.assigned_complex = assignedComplex;
        metadata.institution = studentInstitution;
      }

      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: metadata }
      });
      
      if (error) {
        alert(`Registration Error: ${error.message}`);
      } else if (data.user) {
        const profilePayload: any = {
          id: data.user.id,
          email: email,
          full_name: fullName,
          role: selectedRole,
          is_approved: false,
          phone: selectedRole === 'caretaker' ? phone : studentPhone,
          property_complex: selectedRole === 'caretaker' ? propertyComplex : '',
          unit_count: selectedRole === 'caretaker' ? unitCount : '',
          room_number: selectedRole === 'student' ? roomNumber : '',
          assigned_complex: selectedRole === 'student' ? assignedComplex : '',
          institution: selectedRole === 'caretaker' ? caretakerInstitution : studentInstitution
        };

        await supabase.from('profiles').upsert(profilePayload);
        
        alert('Registration successful! Please check your email inbox to verify your email address before continuing.');
        setAuthMode('signin');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert(error.message);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    const isNative = Capacitor.isNativePlatform();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: isNative ? 'querator://login-callback' : window.location.origin,
      },
    });
    if (error) alert(`Google sign-in error: ${error.message}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex items-center space-x-3 text-purple-400 font-medium animate-pulse">
          <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full animate-bounce"></div>
          <span className="text-lg tracking-wide">Loading Querator Shuttle...</span>
        </div>
      </div>
    );
  }

  const activeRole = userProfile?.role?.trim().toLowerCase();
  const isApproved = userProfile?.is_approved;
  const isEmailVerified = session?.user?.email_confirmed_at || session?.user?.identities?.[0]?.provider !== 'email';

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans selection:bg-purple-600 selection:text-white">
      {/* Header */}
      <header className="bg-black/60 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-800/80 px-6 py-4 flex justify-between items-center transition-all">
        <div 
          onClick={() => navigate('/')} 
          className="cursor-pointer select-none flex items-center space-x-3 group"
        >
          <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 via-purple-600 to-pink-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-105 group-hover:rotate-3 transition duration-300">
            <svg className="w-6 h-6 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">Querator</span>
        </div>

        {session && (
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              setSession(null);
              setUserProfile(null);
              setNeedsProfileSetup(false);
              navigate('/');
            }}
            className="text-xs font-semibold bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 px-4 py-2 rounded-xl transition duration-200 active:scale-95"
          >
            Sign Out
          </button>
        )}
      </header>

      {/* Main Content View Container handled by React Router */}
      <main className="transition-all duration-500 animate-fadeIn">
        <Routes>
          <Route path="/" element={
            !session ? (
              <div className="flex flex-col items-center justify-center pt-8 px-4 pb-16">
                <div className="bg-[#0c0d10] backdrop-blur-2xl p-8 rounded-3xl shadow-2xl shadow-black/80 border border-gray-800/80 max-w-md w-full text-center relative overflow-hidden transition-all duration-300">
                  <div className="absolute -top-12 -right-12 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl -z-10"></div>
                  
                  <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 via-purple-600 to-pink-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-500/30 animate-bounce">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                      <path d="M6 12v5c3 3 9 3 12 0v-5" />
                    </svg>
                  </div>
                  <h1 className="text-3xl font-black text-white tracking-tight mb-1">
                    {authMode === 'forgot' ? 'Reset Password' : authMode === 'signup' ? 'Create Account' : 'Log in or sign up'}
                  </h1>
                  <p className="text-gray-400 text-xs mb-6">
                    {authMode === 'forgot' ? 'Enter your email to receive a recovery link.' : 'Access your Querator Shuttle account.'}
                  </p>
                  
                  {authMode !== 'forgot' && (
                    <>
                      {/* Google OAuth Button with Neon Gradient Border */}
                      <div className="p-[1px] bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl mb-4 shadow-lg shadow-purple-950/30">
                        <button
                          onClick={handleGoogleSignIn}
                          className="w-full flex items-center justify-center space-x-2 bg-[#121316] text-gray-200 py-3 rounded-2xl font-semibold text-sm hover:bg-[#181a1f] active:scale-[0.99] transition"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                          </svg>
                          <span>Continue with Google</span>
                        </button>
                      </div>

                      <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-800"></div>
                        <span className="flex-shrink mx-4 text-gray-500 text-[10px] tracking-widest font-bold uppercase">OR EMAIL</span>
                        <div className="flex-grow border-t border-gray-800"></div>
                      </div>
                    </>
                  )}

                  {/* Email / Password Form */}
                  <form onSubmit={handleEmailAuth} className="space-y-3 mt-4 text-left">
                    {authMode === 'signup' && (
                      <div className="space-y-3 animate-fadeIn">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Full Name (Letters Only)</label>
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={handleFullNameChange}
                            className="w-full px-4 py-2.5 bg-[#121316] border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 transition"
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Select Role</label>
                          <select
                            value={selectedRole}
                            onChange={(e) => {
                              const newRole = e.target.value as any;
                              setSelectedRole(newRole);
                              if (newRole === 'student') fetchApprovedHouses();
                            }}
                            className="w-full px-4 py-2.5 bg-[#121316] border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 transition"
                          >
                            <option value="student" className="bg-gray-900">Student Commuter</option>
                            <option value="driver" className="bg-gray-900">Shuttle Driver</option>
                            <option value="caretaker" className="bg-gray-900">Housing Caretaker</option>
                          </select>
                        </div>

                        {selectedRole === 'caretaker' && (
                          <div className="bg-[#121316] p-4 rounded-2xl border border-gray-800 space-y-3 animate-fadeIn">
                            <p className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">Caretaker Details</p>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Phone Number (Exactly 10 Digits)</label>
                              <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => handlePhoneInput(e.target.value, setPhone)}
                                maxLength={10}
                                className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                                placeholder="0624487650"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Housing Complex Name</label>
                              <input
                                type="text"
                                required
                                value={propertyComplex}
                                onChange={(e) => setPropertyComplex(e.target.value)}
                                className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                                placeholder="e.g. Campus View Residences"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Units Managed</label>
                              <input
                                type="number"
                                required
                                value={unitCount}
                                onChange={(e) => setUnitCount(e.target.value)}
                                className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                                placeholder="e.g. 24"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Student Institution Category</label>
                              <select
                                value={caretakerInstitution}
                                onChange={(e) => setCaretakerInstitution(e.target.value as any)}
                                className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                              >
                                <option value="vut">VUT Students Only</option>
                                <option value="nwu">NWU Students Only</option>
                                <option value="mix">Mix of Both (VUT & NWU)</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {selectedRole === 'student' && (
                          <div className="bg-[#121316] p-4 rounded-2xl border border-gray-800 space-y-3 animate-fadeIn">
                            <p className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Student Boarding Details</p>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Contact Phone Number (Exactly 10 Digits)</label>
                              <input
                                type="tel"
                                required
                                value={studentPhone}
                                onChange={(e) => handlePhoneInput(e.target.value, setStudentPhone)}
                                maxLength={10}
                                className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                                placeholder="0624487650"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Target Institution</label>
                              <select
                                value={studentInstitution}
                                onChange={(e) => setStudentInstitution(e.target.value as any)}
                                className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                              >
                                <option value="vut">Vaal University of Technology (VUT)</option>
                                <option value="nwu">North-West University (NWU)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Assigned Approved Housing Complex</label>
                              <select
                                required
                                value={assignedComplex}
                                onChange={(e) => setAssignedComplex(e.target.value)}
                                className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                              >
                                <option value="">-- Select Approved Residence --</option>
                                {approvedHouses.length > 0 ? (
                                  approvedHouses.map((house, idx) => (
                                    <option key={idx} value={house} className="bg-gray-900">{house}</option>
                                  ))
                                ) : (
                                  <option value="" disabled>No approved houses available yet</option>
                                )}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Room Number / Unit</label>
                              <input
                                type="text"
                                required
                                value={roomNumber}
                                onChange={(e) => setRoomNumber(e.target.value)}
                                className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                                placeholder="e.g. Room 104B"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Email Input with Neon Glow Wrap */}
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email Address</label>
                      <div className="p-[1px] bg-gradient-to-r from-cyan-500/50 via-purple-500/50 to-pink-500/50 rounded-xl">
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-2.5 bg-[#121316] rounded-xl text-sm text-white focus:outline-none transition"
                          placeholder="name@example.com"
                        />
                      </div>
                    </div>

                    {/* Password Input (Hidden if in Forgot Mode) */}
                    {authMode !== 'forgot' && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Password</label>
                          {authMode === 'signin' && (
                            <button
                              type="button"
                              onClick={() => setAuthMode('forgot')}
                              className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition"
                            >
                              Forgot Password?
                            </button>
                          )}
                        </div>
                        <div className="p-[1px] bg-gradient-to-r from-cyan-500/50 via-purple-500/50 to-pink-500/50 rounded-xl">
                          <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[#121316] rounded-xl text-sm text-white focus:outline-none transition"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 text-white py-3 rounded-2xl font-semibold text-sm shadow-lg shadow-purple-950/50 hover:opacity-95 active:scale-[0.99] transition duration-200 mt-3"
                    >
                      {authMode === 'forgot' ? 'Send Reset Link' : authMode === 'signin' ? 'Sign In' : 'Register & Verify Email'}
                    </button>
                  </form>

                  <div className="flex justify-center items-center mt-5 text-xs space-x-4">
                    {authMode === 'forgot' ? (
                      <button
                        type="button"
                        onClick={() => setAuthMode('signin')}
                        className="text-gray-400 hover:text-cyan-400 font-semibold transition"
                      >
                        Back to Sign In
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                        className="text-gray-400 hover:text-cyan-400 font-semibold transition"
                      >
                        {authMode === 'signin' ? 'Need an account? Register with a Role' : 'Already have an account? Sign In'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : needsProfileSetup ? (
              <div className="flex flex-col items-center justify-center pt-8 px-4 pb-16 animate-fadeIn">
                <div className="bg-[#0c0d10] backdrop-blur-2xl p-8 rounded-3xl shadow-2xl border border-gray-800 max-w-md w-full text-center">
                  <h1 className="text-2xl font-black text-white mb-1">Complete Your Profile</h1>
                  <p className="text-gray-400 text-xs mb-6">Select your role and enter your details to finish setting up your account.</p>
                  
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (selectedRole === 'caretaker' && phone.length !== 10) {
                      alert('Phone number must be exactly 10 digits.');
                      return;
                    }
                    if (selectedRole === 'student' && studentPhone.length !== 10) {
                      alert('Phone number must be exactly 10 digits.');
                      return;
                    }

                    const profilePayload = {
                      id: session.user.id,
                      email: session.user.email,
                      full_name: fullName || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
                      role: selectedRole,
                      is_approved: false,
                      phone: selectedRole === 'caretaker' ? phone : studentPhone,
                      property_complex: selectedRole === 'caretaker' ? propertyComplex : '',
                      unit_count: selectedRole === 'caretaker' ? unitCount : '',
                      room_number: selectedRole === 'student' ? roomNumber : '',
                      assigned_complex: selectedRole === 'student' ? assignedComplex : '',
                      institution: selectedRole === 'caretaker' ? caretakerInstitution : studentInstitution
                    };

                    const { error } = await supabase.from('profiles').upsert(profilePayload);
                    if (error) {
                      alert(`Error saving profile: ${error.message}`);
                    } else {
                      setNeedsProfileSetup(false);
                      fetchUserProfile(session.user.id, session.user.email);
                    }
                  }} className="space-y-3 text-left">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Full Name (Letters Only)</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={handleFullNameChange}
                        className="w-full px-4 py-2.5 bg-[#121316] border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Select Your Role</label>
                      <select
                        value={selectedRole}
                        onChange={(e) => {
                          const newRole = e.target.value as any;
                          setSelectedRole(newRole);
                          if (newRole === 'student') fetchApprovedHouses();
                        }}
                        className="w-full px-4 py-2.5 bg-[#121316] border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="student" className="bg-gray-900">Student Commuter</option>
                        <option value="driver" className="bg-gray-900">Shuttle Driver</option>
                        <option value="caretaker" className="bg-gray-900">Housing Caretaker</option>
                      </select>
                    </div>

                    {selectedRole === 'caretaker' && (
                      <div className="bg-[#121316] p-4 rounded-2xl border border-gray-800 space-y-3">
                        <p className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">Caretaker Details</p>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 mb-1">Phone Number (10 Digits)</label>
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => handlePhoneInput(e.target.value, setPhone)}
                            maxLength={10}
                            className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white"
                            placeholder="0624487650"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 mb-1">Housing Complex Name</label>
                          <input
                            type="text"
                            required
                            value={propertyComplex}
                            onChange={(e) => setPropertyComplex(e.target.value)}
                            className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white"
                            placeholder="e.g. Campus View Residences"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 mb-1">Units Managed</label>
                          <input
                            type="number"
                            required
                            value={unitCount}
                            onChange={(e) => setUnitCount(e.target.value)}
                            className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white"
                            placeholder="e.g. 24"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 mb-1">Student Institution Category</label>
                          <select
                            value={caretakerInstitution}
                            onChange={(e) => setCaretakerInstitution(e.target.value as any)}
                            className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white"
                          >
                            <option value="vut">VUT Students Only</option>
                            <option value="nwu">NWU Students Only</option>
                            <option value="mix">Mix of Both (VUT & NWU)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {selectedRole === 'student' && (
                      <div className="bg-[#121316] p-4 rounded-2xl border border-gray-800 space-y-3">
                        <p className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Student Boarding Details</p>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 mb-1">Contact Phone Number (10 Digits)</label>
                          <input
                            type="tel"
                            required
                            value={studentPhone}
                            onChange={(e) => handlePhoneInput(e.target.value, setStudentPhone)}
                            maxLength={10}
                            className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white"
                            placeholder="0624487650"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 mb-1">Target Institution</label>
                          <select
                            value={studentInstitution}
                            onChange={(e) => setStudentInstitution(e.target.value as any)}
                            className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white"
                          >
                            <option value="vut">Vaal University of Technology (VUT)</option>
                            <option value="nwu">North-West University (NWU)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 mb-1">Assigned Approved Housing Complex</label>
                          <select
                            required
                            value={assignedComplex}
                            onChange={(e) => setAssignedComplex(e.target.value)}
                            className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white"
                          >
                            <option value="">-- Select Approved Residence --</option>
                            {approvedHouses.length > 0 ? (
                              approvedHouses.map((house, idx) => (
                                <option key={idx} value={house} className="bg-gray-900">{house}</option>
                              ))
                            ) : (
                              <option value="" disabled>No approved houses available yet</option>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 mb-1">Room Number / Unit</label>
                          <input
                            type="text"
                            required
                            value={roomNumber}
                            onChange={(e) => setRoomNumber(e.target.value)}
                            className="w-full px-3 py-2 bg-black border border-gray-800 rounded-xl text-xs text-white"
                            placeholder="e.g. Room 104B"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 text-white py-3 rounded-2xl font-semibold text-sm shadow-lg hover:opacity-95 transition mt-4"
                    >
                      Save Profile & Continue
                    </button>
                  </form>
                </div>
              </div>
            ) : !isEmailVerified ? (
              <div className="min-h-[75vh] flex items-center justify-center px-4 animate-fadeIn">
                <div className="bg-[#0c0d10] p-8 rounded-3xl shadow-xl border border-gray-800 max-w-md w-full text-center relative overflow-hidden">
                  <div className="w-12 h-12 bg-purple-950 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl font-bold animate-pulse">✉️</div>
                  <h1 className="text-2xl font-bold text-white mb-2">Verify Your Email</h1>
                  <p className="text-gray-400 text-sm leading-relaxed mb-6">
                    We've sent a verification link to your email address. Please click the link inside your email to activate your account and access the shuttle portal.
                  </p>
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setSession(null);
                      setUserProfile(null);
                      setNeedsProfileSetup(false);
                    }}
                    className="bg-gray-900 hover:bg-gray-800 text-gray-300 px-4 py-2 rounded-xl text-xs font-semibold transition border border-gray-800"
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            ) : userProfile && !isApproved && activeRole !== 'admin' ? (
              <div className="min-h-[75vh] flex items-center justify-center px-4 animate-fadeIn">
                <div className="bg-[#0c0d10] p-8 rounded-3xl shadow-xl border border-gray-800 max-w-md w-full text-center relative overflow-hidden">
                  <div className="w-12 h-12 bg-amber-950/50 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl font-bold animate-pulse">⏳</div>
                  <h1 className="text-2xl font-bold text-white mb-2">Approval Pending</h1>
                  <p className="text-gray-400 text-sm leading-relaxed mb-6">
                    Your email is verified! However, your application as a <span className="font-semibold uppercase text-gray-200">{activeRole}</span> is currently pending review and clearance by management. Access will unlock automatically once approved.
                  </p>
                </div>
              </div>
            ) : (
              <div className="animate-fadeIn">
                {activeRole === 'admin' && <AdminDashboard />}
                {activeRole === 'student' && userProfile?.id && <StudentDashboard studentId={userProfile.id} />}
                {activeRole === 'driver' && userProfile?.id && <DriverDashboard driverId={userProfile.id} />}
                {activeRole === 'caretaker' && userProfile?.id && <CaretakerDashboard caretakerId={userProfile.id} />}
              </div>
            )
          } />

          {/* Secure Hidden Admin Route Protected by AdminGate */}
          <Route 
            path="/hidden-admin-dashboard" 
            element={
              <AdminGate>
                <div className="bg-gradient-to-r from-gray-950 via-purple-950 to-gray-950 text-white text-center py-1.5 text-xs font-bold tracking-widest uppercase shadow-inner border-b border-gray-800">
                  Admin Control Panel — Secure Gateway Active
                </div>
                <AdminDashboard />
              </AdminGate>
            } 
          />

          {/* Fallback Catch-all Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <MainApp />
    </Router>
  );
}
