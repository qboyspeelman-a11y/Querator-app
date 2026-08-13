import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function AdminDashboard() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [houses, setHouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Time Slot Form State
  const [institution, setInstitution] = useState<'vut' | 'nwu'>('vut');
  const [direction, setDirection] = useState<'To Campus' | 'From Campus'>('To Campus');
  const [timeSlot, setTimeSlot] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const { data: profileData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { data: slotData } = await supabase.from('shuttle_slots').select('*').order('time_slot', { ascending: true });
    const { data: houseData } = await supabase.from('housing_complexes').select('*');

    if (profileData) setProfiles(profileData);
    if (slotData) setSlots(slotData);
    if (houseData) setHouses(houseData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Handlers ---
  const handleApproval = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_approved: !currentStatus }).eq('id', id);
    if (!error) fetchData();
  };

  const handleRemoveUser = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove ${name}?`)) {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (!error) fetchData();
    }
  };

  const toggleAccreditation = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('housing_complexes').update({ is_accredited: !currentStatus }).eq('id', id);
    if (!error) fetchData();
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('shuttle_slots').insert({ institution, direction, time_slot: timeSlot, is_active: true });
    setTimeSlot('');
    fetchData();
  };

  const handleDeleteSlot = async (slotId: string) => {
    await supabase.from('shuttle_slots').delete().eq('id', slotId);
    fetchData();
  };

  if (loading) return <div className="p-6 text-center text-gray-600 font-medium">Loading Admin Control Center...</div>;

  const pendingUsers = profiles.filter(p => !p.is_approved && p.role !== 'admin');
  const approvedDrivers = profiles.filter(p => p.role === 'driver' && p.is_approved);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-gray-900">
        <h1 className="text-2xl font-bold text-gray-900">Admin Management Dashboard</h1>
        <p className="text-gray-600 text-sm">Control Shuttle Slots, Drivers, and Housing Accreditation.</p>
      </div>

      {/* 1. Time Slot Manager */}
      <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-indigo-600">
        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Shuttle Time Slot Manager</h2>
        <form onSubmit={handleAddSlot} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end mb-6">
          <select value={institution} onChange={(e: any) => setInstitution(e.target.value)} className="w-full px-3 py-2 border rounded text-sm bg-white"><option value="vut">VUT</option><option value="nwu">NWU</option></select>
          <select value={direction} onChange={(e: any) => setDirection(e.target.value)} className="w-full px-3 py-2 border rounded text-sm bg-white"><option value="To Campus">To Campus</option><option value="From Campus">From Campus</option></select>
          <input type="text" required value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g. 07:30 AM" />
          <button type="submit" className="bg-indigo-600 text-white py-2 rounded text-sm font-bold hover:bg-indigo-700">Add Slot</button>
        </form>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {slots.map((s) => (
            <div key={s.id} className="p-3 border rounded bg-gray-50 flex justify-between items-center text-sm">
              <div><span className="text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">{s.institution}</span> <span className="font-bold">{s.time_slot}</span><p className="text-[10px] text-gray-500">{s.direction}</p></div>
              <button onClick={() => handleDeleteSlot(s.id)} className="text-red-600 font-bold text-xs">Delete</button>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Accredited Housing Manager */}
      <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-600">
        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Accredited Housing Complexes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {houses.map((h) => (
            <div key={h.id} className={`p-4 border rounded-lg flex justify-between items-center ${h.is_accredited ? 'bg-blue-50' : 'bg-red-50'}`}>
              <div>
                <h3 className="font-bold text-gray-900">{h.complex_name}</h3>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${h.is_accredited ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                  {h.is_accredited ? 'Active' : 'Suspended'}
                </span>
              </div>
              <button onClick={() => toggleAccreditation(h.id, h.is_accredited)} className={`px-3 py-1.5 rounded text-xs font-bold ${h.is_accredited ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
                {h.is_accredited ? 'Revoke' : 'Restore'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Driver Management */}
      <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-green-600">
        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Active Approved Drivers</h2>
        {approvedDrivers.map((d) => (
          <div key={d.id} className="p-4 border rounded-lg bg-green-50/40 flex justify-between items-center mb-3">
            <div>
              <p className="font-bold text-gray-900">{d.full_name}</p>
              <p className="text-xs text-gray-600">{d.email}</p>
            </div>
            <div className="space-x-2">
              <button onClick={() => handleApproval(d.id, d.is_approved)} className="bg-amber-500 text-white px-3 py-1 rounded text-xs font-bold">Suspend</button>
              <button onClick={() => handleRemoveUser(d.id, d.full_name)} className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">Fire</button>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Pending Approvals */}
      <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-yellow-500">
        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Pending Approvals ({pendingUsers.length})</h2>
        {pendingUsers.map((u) => (
          <div key={u.id} className="p-4 border rounded-lg bg-gray-50 flex justify-between items-center mb-3">
            <div>
              <p className="font-bold text-gray-900">{u.full_name} <span className="text-[10px] bg-gray-200 px-2 rounded">{u.role}</span></p>
            </div>
            <button onClick={() => handleApproval(u.id, u.is_approved)} className="bg-green-600 text-white px-4 py-2 rounded text-xs font-bold">Approve</button>
          </div>
        ))}
      </div>
    </div>
  );
}