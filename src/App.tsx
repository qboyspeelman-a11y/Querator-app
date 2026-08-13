import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { AdminDashboard } from './AdminDashboard';
import { CaretakerDashboard } from './CaretakerDashboard';
import { DriverDashboard } from './DriverDashboard';
import { StudentDashboard } from './StudentDashboard';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
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

  // Secret Admin Backdoor State (5 clicks on logo)
  const [logoClicks, setLogoClicks] = useState(0);
  const [backdoorAdminActive, setBackdoorAdminActive] = useState(false);

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
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch or auto-create profile if missing
  async function fetchUserProfile(userId: string, userEmail: string) {
    setLoading(true);
    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      const defaultPayload = {
        id: userId,
        email: userEmail,
        full_name: userEmail?.split('@')[0] || 'User',
        role: 'student',
        is_approved: false
      };

      const { data: createdData } = await supabase
        .from('profiles')
        .upsert(defaultPayload)
        .select()
        .single();

      data = createdData;
    }

    setUserProfile(data || null);
    setLoading(false);
  }

  // Handle Email Sign-in & Sign-up with Verification trigger
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'signup') {
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) alert(`Google sign-in error: ${error.message}`);
  };

  const handleLogoClick = () => {
    const newClicks = logoClicks + 1;
    setLogoClicks(newClicks);
    if (newClicks >= 5) {
      setBackdoorAdminActive(true);
      setLogoClicks(0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
        <div className="flex items-center space-x-3 text-blue-600 font-medium animate-pulse">
          <div className="w-4 h-4 bg-blue-600 rounded-full animate-bounce"></div>
          <span className="text-lg tracking-wide">Loading Querator Shuttle...</span>
        </div>
      </div>
    );
  }

  const activeRole = userProfile?.role?.trim().toLowerCase();
  const isApproved = userProfile?.is_approved;
  
  // Check if email is verified via Supabase session user metadata
  const isEmailVerified = session?.user?.email_confirmed_at || session?.user?.identities?.[0]?.provider !== 'email';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50/20 text-gray-900 font-sans selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-xs border-b border-gray-100 px-6 py-4 flex justify-between items-center transition-all">
        <div onClick={handleLogoClick} className="cursor-pointer select-none flex items-center space-x-3 group">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 group-hover:rotate-3 transition duration-300">
            <svg className="w-6 h-6 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Querator Shuttle</span>
        </div>

        {(session || backdoorAdminActive) && (
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              setSession(null);
              setUserProfile(null);
              setBackdoorAdminActive(false);
            }}
            className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl transition duration-200 shadow-2xs active:scale-95"
          >
            Sign Out / Exit
          </button>
        )}
      </header>

      {/* Main Content View */}
      <main className="transition-all duration-500 animate-fadeIn">
        {backdoorAdminActive ? (
          <div>
            <div className="bg-gradient-to-r from-gray-900 via-blue-950 to-gray-900 text-white text-center py-1.5 text-xs font-bold tracking-widest uppercase shadow-inner">
              Admin Control Panel — Backdoor Active
            </div>
            <AdminDashboard />
          </div>
        ) : !session ? (
          <div className="flex flex-col items-center justify-center pt-8 px-4 pb-16">
            <div className="bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl shadow-blue-950/5 border border-white max-w-md w-full text-center relative overflow-hidden transition-all duration-300">
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-400/10 rounded-full blur-3xl -z-10"></div>
              
              <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-500/30 animate-bounce">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
              </div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-1">Querator Shuttle Portal</h1>
              <p className="text-gray-400 text-xs mb-6">Sign in or register your account with secure email verification.</p>
              
              {/* Google OAuth Button */}
              <button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center space-x-2 bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl font-semibold text-sm hover:bg-gray-50/80 active:scale-[0.99] transition shadow-sm mb-4"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign in with Google</span>
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-100"></div>
                <span className="flex-shrink mx-4 text-gray-300 text-[10px] tracking-widest font-bold uppercase">OR EMAIL</span>
                <div className="flex-grow border-t border-gray-100"></div>
              </div>

              {/* Email / Password Form */}
              <form onSubmit={handleEmailAuth} className="space-y-3 mt-4 text-left">
                {authMode === 'signup' && (
                  <div className="space-y-3 animate-fadeIn">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">Select Role</label>
                      <select
                        value={selectedRole}
                        onChange={(e) => {
                          const newRole = e.target.value as any;
                          setSelectedRole(newRole);
                          if (newRole === 'student') fetchApprovedHouses();
                        }}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                      >
                        <option value="student">Student Commuter</option>
                        <option value="driver">Shuttle Driver</option>
                        <option value="caretaker">Housing Caretaker</option>
                      </select>
                    </div>

                    {selectedRole === 'caretaker' && (
                      <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 space-y-3 animate-fadeIn">
                        <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Caretaker Details</p>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Phone Number</label>
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            placeholder="062 448 7650"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Housing Complex Name</label>
                          <input
                            type="text"
                            required
                            value={propertyComplex}
                            onChange={(e) => setPropertyComplex(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            placeholder="e.g. Campus View Residences"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Units Managed</label>
                          <input
                            type="number"
                            required
                            value={unitCount}
                            onChange={(e) => setUnitCount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            placeholder="e.g. 24"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Student Institution Category</label>
                          <select
                            value={caretakerInstitution}
                            onChange={(e) => setCaretakerInstitution(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="vut">VUT Students Only</option>
                            <option value="nwu">NWU Students Only</option>
                            <option value="mix">Mix of Both (VUT & NWU)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {selectedRole === 'student' && (
                      <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-100/60 space-y-3 animate-fadeIn">
                        <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Student Boarding Details</p>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-600 mb-1">Contact Phone Number</label>
                          <input
                            type="tel"
                            required
                            value={studentPhone}
                            onChange={(e) => setStudentPhone(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            placeholder="062 448 7650"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-600 mb-1">Target Institution</label>
                          <select
                            value={studentInstitution}
                            onChange={(e) => setStudentInstitution(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="vut">Vaal University of Technology (VUT)</option>
                            <option value="nwu">North-West University (NWU)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-600 mb-1">Assigned Approved Housing Complex</label>
                          <select
                            required
                            value={assignedComplex}
                            onChange={(e) => setAssignedComplex(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="">-- Select Approved Residence --</option>
                            {approvedHouses.length > 0 ? (
                              approvedHouses.map((house, idx) => (
                                <option key={idx} value={house}>{house}</option>
                              ))
                            ) : (
                              <option value="" disabled>No approved houses available yet</option>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-600 mb-1">Room Number / Unit</label>
                          <input
                            type="text"
                            required
                            value={roomNumber}
                            onChange={(e) => setRoomNumber(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            placeholder="e.g. Room 104B"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-2xl font-semibold text-sm shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] transition duration-200 mt-2"
                >
                  {authMode === 'signin' ? 'Sign In' : 'Register & Verify Email'}
                </button>
              </form>

              <div className="flex justify-center items-center mt-4 text-xs">
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                  className="text-blue-600 hover:text-indigo-700 font-semibold transition"
                >
                  {authMode === 'signin' ? 'Need an account? Register with a Role' : 'Already have an account? Sign In'}
                </button>
              </div>
            </div>
          </div>
        ) : !isEmailVerified ? (
          <div className="min-h-[75vh] flex items-center justify-center px-4 animate-fadeIn">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full text-center relative overflow-hidden">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl font-bold animate-pulse">✉️</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                We've sent a verification link to your email address. Please click the link inside your email to activate your account and access the shuttle portal.
              </p>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setSession(null);
                  setUserProfile(null);
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-semibold transition"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        ) : userProfile && !isApproved && activeRole !== 'admin' ? (
          <div className="min-h-[75vh] flex items-center justify-center px-4 animate-fadeIn">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full text-center relative overflow-hidden">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl font-bold animate-pulse">⏳</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Approval Pending</h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Your email is verified! However, your application as a <span className="font-semibold uppercase text-gray-800">{activeRole}</span> is currently pending review and clearance by management. Access will unlock automatically once approved.
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
        )}
      </main>
    </div>
  );
}