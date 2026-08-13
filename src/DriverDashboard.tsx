import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function DriverDashboard({ driverId }: { driverId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'vut' | 'nwu'>('vut');

  console.log('Active Driver ID:', driverId);
  
  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transport_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('public:transport_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateTripStatus = async (requestId: string, newStatus: string) => {
    const { error } = await supabase
      .from('transport_requests')
      .update({ status: newStatus })
      .eq('id', requestId);

    if (error) {
      alert(`Error updating status: ${error.message}`);
    } else {
      fetchRequests();
    }
  };

  // Google Maps helper for a single residence stop
  const openSingleNavigation = (complexName: string, pickupLocation: string) => {
    const query = encodeURIComponent(`${complexName}, ${pickupLocation}, Vanderbijlpark`);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(mapsUrl, '_blank');
  };

  // Google Maps helper for multi-stop time window routes
  const openMultiStopNavigation = (complexes: string[]) => {
    if (complexes.length === 0) return;
    
    const encodedComplexes = complexes.map(c => encodeURIComponent(`${c}, Vanderbijlpark`));
    const destination = encodedComplexes[encodedComplexes.length - 1];
    
    let mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    
    if (encodedComplexes.length > 1) {
      const waypoints = encodedComplexes.slice(0, encodedComplexes.length - 1).join('|');
      mapsUrl += `&waypoints=${waypoints}`;
    }

    window.open(mapsUrl, '_blank');
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-600 font-medium">Loading Driver Dispatch Feed...</div>;
  }

  const filteredByInstitution = requests.filter(req => (req.institution || 'vut').toLowerCase() === activeTab);

  const groupedRoutes: { [time: string]: { [complex: string]: any[] } } = {};
  filteredByInstitution.forEach((req) => {
    const time = req.scheduled_time || 'Unscheduled';
    const complex = req.assigned_complex || 'General Pickup';
    if (!groupedRoutes[time]) groupedRoutes[time] = {};
    if (!groupedRoutes[time][complex]) groupedRoutes[time][complex] = [];
    groupedRoutes[time][complex].push(req);
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-green-600 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Shuttle Driver Route Dispatch & GPS</h1>
          <p className="text-gray-600 text-sm">Select institution tab and launch Google Maps navigation for pickup stops.</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
          <button
            onClick={() => setActiveTab('vut')}
            className={`px-6 py-2 rounded-lg text-xs font-extrabold uppercase transition ${activeTab === 'vut' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-900'}`}
          >
            VUT Routes ({requests.filter(r => (r.institution || 'vut') === 'vut').length})
          </button>
          <button
            onClick={() => setActiveTab('nwu')}
            className={`px-6 py-2 rounded-lg text-xs font-extrabold uppercase transition ${activeTab === 'nwu' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:text-gray-900'}`}
          >
            NWU Routes ({requests.filter(r => r.institution === 'nwu').length})
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-r-lg flex justify-between items-center">
          <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
            Active Viewing: {activeTab.toUpperCase()} Campus Shuttle Queue
          </p>
          <span className="text-xs text-indigo-700 font-semibold">{filteredByInstitution.length} Total Requests</span>
        </div>

        {Object.keys(groupedRoutes).length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center text-gray-500 italic">
            No active transport requests for {activeTab.toUpperCase()} at the moment.
          </div>
        ) : (
          Object.entries(groupedRoutes).map(([timeSlot, complexes]) => {
            const complexNames = Object.keys(complexes);
            
            return (
              <div key={timeSlot} className="bg-white rounded-lg shadow-md border-l-4 border-purple-600 overflow-hidden">
                <div className="bg-purple-50 px-6 py-3 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="font-bold text-purple-900 text-sm uppercase tracking-wide">🕒 Time Window: {timeSlot}</span>
                  
                  <div className="flex items-center space-x-3">
                    <span className="bg-purple-200 text-purple-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                      {Object.values(complexes).flat().length} Students Booked
                    </span>
                    <button
                      onClick={() => openMultiStopNavigation(complexNames)}
                      className="bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-800 transition flex items-center space-x-1 shadow-sm"
                    >
                      <span>🗺️ Navigate All Stops</span>
                    </button>
                  </div>
                </div>
                
                <div className="p-6 space-y-6">
                  {Object.entries(complexes).map(([complexName, students]) => {
                    const samplePickup = students[0]?.pickup_location || 'Main Gate';
                    
                    return (
                      <div key={complexName} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 border-b pb-2 gap-2">
                          <h3 className="font-bold text-blue-900 text-sm">
                            🏠 Residence Complex: {complexName} <span className="text-xs text-gray-500 font-normal">({students.length} students)</span>
                          </h3>
                          <button
                            onClick={() => openSingleNavigation(complexName, samplePickup)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700 transition flex items-center space-x-1 shadow-2xs"
                          >
                            <span>📍 Open GPS to Stop</span>
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          {students.map((req: any) => (
                            <div key={req.id} className="bg-white p-3 rounded border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <p className="font-bold text-gray-900 text-sm">{req.student_name}</p>
                                  <span className="bg-green-100 text-green-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded">
                                    Room {req.room_number || 'N/A'}
                                  </span>
                                </div>
                                <p className="text-xs text-blue-700 font-medium mt-1">📍 Pickup Spot: {req.pickup_location}</p>
                              </div>

                              <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                  req.status === 'Dispatched' ? 'bg-green-100 text-green-800' : 
                                  req.status === 'Completed' ? 'bg-gray-200 text-gray-700' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {req.status}
                                </span>

                                {req.status !== 'Dispatched' && (
                                  <button
                                    onClick={() => updateTripStatus(req.id, 'Dispatched')}
                                    className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700 transition"
                                  >
                                    Dispatch
                                  </button>
                                )}

                                {req.status === 'Dispatched' && (
                                  <button
                                    onClick={() => updateTripStatus(req.id, 'Completed')}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700 transition"
                                  >
                                    Complete
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}