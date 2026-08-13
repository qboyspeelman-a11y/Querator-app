import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function StudentDashboard({ studentId }: { studentId: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [isAccredited, setIsAccredited] = useState<boolean | null>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Booking Form State
  const [direction, setDirection] = useState<'To Campus' | 'From Campus'>('To Campus');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');

  const fetchData = async () => {
    setLoading(true);

    // 1. Fetch student profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .single();

    if (profileData) {
      setProfile(profileData);

      // 2. Fetch housing complex accreditation status
      const { data: houseData } = await supabase
        .from('housing_complexes')
        .select('is_accredited')
        .eq('complex_name', profileData.assigned_complex)
        .single();

      setIsAccredited(houseData?.is_accredited ?? false);

      // 3. Fetch active shuttle slots for their institution
      const { data: slotData } = await supabase
        .from('shuttle_slots')
        .select('*')
        .eq('institution', profileData.institution || 'vut');

      if (slotData) setSlots(slotData);
    }

    // 4. Fetch student's existing transport requests
    const { data: reqData } = await supabase
      .from('transport_requests')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (reqData) setRequests(reqData);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('student_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_requests', filter: `student_id=eq.${studentId}` }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !pickupLocation) {
      alert('Please fill in all booking details.');
      return;
    }

    const { error } = await supabase.from('transport_requests').insert({
      student_id: studentId,
      student_name: profile.full_name,
      assigned_complex: profile.assigned_complex,
      room_number: profile.room_number,
      institution: profile.institution,
      pickup_location: pickupLocation,
      scheduled_time: selectedSlot,
      status: 'Pending Dispatch'
    });

    if (error) {
      alert(`Booking error: ${error.message}`);
    } else {
      alert('Shuttle transport requested successfully!');
      setSelectedSlot('');
      setPickupLocation('');
      fetchData();
    }
  };

  const cancelRequest = async (requestId: string) => {
    const { error } = await supabase.from('transport_requests').delete().eq('id', requestId);
    if (!error) fetchData();
  };

  // Google Maps helper for tracking individual stops
  const openSingleNavigation = (complexName: string, spot: string) => {
    const query = encodeURIComponent(`${complexName}, ${spot}, Vanderbijlpark`);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(mapsUrl, '_blank');
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-600 font-medium">Loading Student Dashboard...</div>;
  }

  // Accreditation & Approval Gate
  const canBook = profile?.is_approved && isAccredited;
  const activeDispatchedTrip = requests.find(r => r.status === 'Dispatched');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Student Info Header */}
      <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-600 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Student Commuter Portal</h1>
          <p className="text-gray-600 text-sm">
            Welcome, <span className="font-semibold">{profile?.full_name}</span> ({profile?.institution?.toUpperCase()})
          </p>
        </div>
        <div className="text-left sm:text-right bg-blue-50 p-3 rounded-lg border border-blue-100 w-full sm:w-auto">
          <p className="text-xs font-bold text-blue-900">🏠 Residence: {profile?.assigned_complex || 'Not Assigned'}</p>
          <p className="text-xs text-blue-700 font-medium">Room: {profile?.room_number || 'N/A'}</p>
        </div>
      </div>

      {/* Live Realtime Dispatch Notification Banner */}
      {activeDispatchedTrip && (
        <div className="bg-green-600 text-white p-4 rounded-lg shadow-lg flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🚐</span>
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wide">Shuttle Is Dispatched & En Route!</h3>
              <p className="text-xs text-green-100">
                Your pickup at <span className="font-bold underline">{activeDispatchedTrip.pickup_location}</span> for slot {activeDispatchedTrip.scheduled_time} is on the way.
              </p>
            </div>
          </div>
          <span className="bg-white text-green-800 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow-inner">
            Active Ride
          </span>
        </div>
      )}

      {/* Access Control / Accreditation Check */}
      {!profile?.is_approved ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-lg text-center shadow-sm">
          <h2 className="font-bold text-yellow-800 text-lg mb-1">Account Pending Approval</h2>
          <p className="text-sm text-yellow-700">
            Your student account is currently awaiting clearance by management. Booking features will unlock automatically upon approval.
          </p>
        </div>
      ) : !isAccredited ? (
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-lg text-center shadow-sm">
          <h2 className="font-bold text-red-800 text-lg mb-1">Shuttle Bookings Suspended</h2>
          <p className="text-sm text-red-700">
            The accreditation for your housing complex (<span className="font-semibold">{profile?.assigned_complex}</span>) is currently suspended due to compliance or payment status. Please contact your caretaker.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Booking Form */}
          <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-indigo-600">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Request Shuttle Transport</h2>
            
            <form onSubmit={handleBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Direction</label>
                <select
                  value={direction}
                  onChange={(e: any) => setDirection(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="To Campus">To Campus</option>
                  <option value="From Campus">From Campus</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Select Time Slot</label>
                <select
                  required
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose Time Window --</option>
                  {slots
                    .filter(s => s.direction === direction)
                    .map((s) => (
                      <option key={s.id} value={s.time_slot}>{s.time_slot} ({s.direction})</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Specific Pickup Point / Gate</label>
                <input
                  type="text"
                  required
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Main Entrance Gate"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-md hover:bg-indigo-700 transition text-sm shadow-md"
              >
                Submit Transport Request
              </button>
            </form>
          </div>

          {/* Active Bookings Feed */}
          <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-green-600">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Your Active Requests ({requests.length})</h2>
            
            {requests.length === 0 ? (
              <p className="text-xs text-gray-500 italic">You have no active transport requests submitted.</p>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {requests.map((req) => (
                  <div key={req.id} className="p-3 border rounded-lg bg-gray-50 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-extrabold text-xs text-indigo-700">🕒 {req.scheduled_time}</span>
                        <p className="text-xs text-gray-600 mt-0.5">📍 {req.pickup_location}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        req.status === 'Dispatched' ? 'bg-green-100 text-green-800' : 
                        req.status === 'Completed' ? 'bg-gray-200 text-gray-700' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t">
                      <button
                        onClick={() => openSingleNavigation(profile.assigned_complex, req.pickup_location)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center space-x-1"
                      >
                        <span>📍 View on Google Maps</span>
                      </button>

                      {req.status === 'Pending Dispatch' && (
                        <button
                          onClick={() => cancelRequest(req.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-bold"
                        >
                          Cancel Request
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}