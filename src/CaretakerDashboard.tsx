import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function CaretakerDashboard({ caretakerId }: { caretakerId: string }) {
  const [caretakerProfile, setCaretakerProfile] = useState<any>(null);
  const [complexStatus, setComplexStatus] = useState<any>(null);
  const [assignedStudents, setAssignedStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCaretakerData = async () => {
    setLoading(true);

    // 1. Fetch caretaker profile to know which property complex they manage
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', caretakerId)
      .single();

    if (profileError || !profileData) {
      setLoading(false);
      return;
    }

    setCaretakerProfile(profileData);
    const complexName = profileData.property_complex;

    if (complexName) {
      // 2. Fetch the accreditation status of their property complex
      const { data: houseData } = await supabase
        .from('housing_complexes')
        .select('*')
        .eq('complex_name', complexName)
        .single();

      setComplexStatus(houseData);

      // 3. Fetch all students registered under this specific complex
      const { data: studentData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .eq('assigned_complex', complexName)
        .order('full_name', { ascending: true });

      if (studentData) {
        setAssignedStudents(studentData);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchCaretakerData();
  }, [caretakerId]);

  if (loading) {
    return <div className="p-6 text-center text-gray-600 font-medium">Loading Caretaker Portal...</div>;
  }

  const isAccredited = complexStatus?.is_accredited ?? false;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header & Complex Overview */}
      <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-purple-600 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Caretaker Management Portal</h1>
          <p className="text-gray-600 text-sm">
            Welcome, <span className="font-semibold">{caretakerProfile?.full_name}</span>
          </p>
        </div>

        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 w-full sm:w-auto text-left sm:text-right">
          <p className="text-xs font-bold text-purple-900 uppercase">Managed Property</p>
          <p className="text-sm font-extrabold text-purple-950">{caretakerProfile?.property_complex || 'Not Assigned'}</p>
          <div className="mt-1">
            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
              isAccredited ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isAccredited ? 'Complex Accredited (Active)' : 'Complex Suspended (Unpaid)'}
            </span>
          </div>
        </div>
      </div>

      {/* Warning banner if accreditation is revoked */}
      {!isAccredited && (
        <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg shadow-xs">
          <h3 className="text-sm font-bold text-red-800">Accreditation Notice</h3>
          <p className="text-xs text-red-700 mt-0.5">
            Your housing complex is currently marked as unaccredited or suspended by administration. Student shuttle bookings for this property are locked until accreditation is restored.
          </p>
        </div>
      )}

      {/* Enlisted Students Management Section */}
      <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-600">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-lg font-bold text-gray-800">
            Students Enlisted in {caretakerProfile?.property_complex}
          </h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-extrabold px-3 py-1 rounded-full">
            {assignedStudents.length} Students Registered
          </span>
        </div>

        {assignedStudents.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-4 text-center">
            No students have registered under your property complex yet.
          </p>
        ) : (
          <div className="space-y-3">
            {assignedStudents.map((student) => (
              <div key={student.id} className="p-4 border rounded-lg bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-900 text-sm">{student.full_name}</span>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded">
                      Room {student.room_number || 'N/A'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Email: {student.email} | Phone: {student.phone || 'N/A'}
                  </p>
                  <p className="text-[11px] text-purple-700 font-semibold mt-0.5">
                    Institution: {student.institution?.toUpperCase() || 'VUT'}
                  </p>
                </div>

                <div>
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                    student.is_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {student.is_approved ? 'Approved Student' : 'Pending Admin Approval'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}