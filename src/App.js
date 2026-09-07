import React, { useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || '',
  process.env.REACT_APP_SUPABASE_ANON_KEY || ''
);

export default function App() {
  const [mcqAnswers, setMcqAnswers] = useState({});
  const [mcqScore, setMcqScore] = useState(null);
  const [essay, setEssay] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const questions = [
    { id: 1, question: "What is the primary function of DNA?", options: ["Energy production", "Genetic storage", "Protein synthesis", "Lipid breakdown"], answer: 1 },
    { id: 2, question: "Which organelle is known as the powerhouse of the cell?", options: ["Ribosome", "Nucleus", "Mitochondria", "Golgi body"], answer: 2 }
  ];

  const handleMcqSelect = (qId, optionIdx) => {
    setMcqAnswers({ ...mcqAnswers, [qId]: optionIdx });
  };

  const calculateMcq = () => {
    let score = 0;
    questions.forEach(q => {
      if (mcqAnswers[q.id] === q.answer) score += 1;
    });
    setMcqScore(score);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err) {
      alert("Microphone access denied or not supported.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const uploadToSupabase = async (file, path) => {
    const { error } = await supabase.storage
      .from('examprepfile')
      .upload(path, file);
    if (error) throw error;
    
    const { data: publicUrlData } = supabase.storage
      .from('examprepfile')
      .getPublicUrl(path);
      
    return publicUrlData.publicUrl;
  };

  const handleSubmitAll = async () => {
    setSubmitting(true);
    setStatus('Uploading files and submitting exam...');
    try {
      let uploadedImageUrl = '';
      let uploadedAudioUrl = '';

      if (imageFile) {
        const imgName = `images/${Date.now()}_${imageFile.name}`;
        uploadedImageUrl = await uploadToSupabase(imageFile, imgName);
      }

      if (audioBlob) {
        const audioName = `audio/${Date.now()}_oral_response.webm`;
        uploadedAudioUrl = await uploadToSupabase(audioBlob, audioName);
      }

      const { error } = await supabase
        .from('exam_submissions')
        .insert([{
          mcq_score: mcqScore !== null ? mcqScore : 0,
          theory_essay: essay,
          theory_image_url: uploadedImageUrl,
          audio_response_url: uploadedAudioUrl
        }]);

      if (error) throw error;
      setStatus('Exam submitted successfully!');
    } catch (err) {
      setStatus('Error submitting exam: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center' }}>Examination Portal</h1>

      {/* Section 1: MCQ */}
      <section style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
        <h2>Section 1: Multiple Choice</h2>
        {questions.map((q) => (
          <div key={q.id} style={{ marginBottom: '12px' }}>
            <p><strong>{q.question}</strong></p>
            {q.options.map((opt, idx) => (
              <label key={idx} style={{ display: 'block', margin: '4px 0' }}>
                <input
                  type="radio"
                  name={`q_${q.id}`}
                  onChange={() => handleMcqSelect(q.id, idx)}
                /> {opt}
              </label>
            ))}
          </div>
        ))}
        <button onClick={calculateMcq} style={{ padding: '8px 16px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px' }}>
          Calculate Score
        </button>
        {mcqScore !== null && <p><strong>Score: {mcqScore} / {questions.length}</strong></p>}
      </section>

      {/* Section 2: Essay & Image */}
      <section style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
        <h2>Section 2: Theory Essay</h2>
        <textarea
          rows={5}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          placeholder="Write your essay answer here..."
          value={essay}
          onChange={(e) => setEssay(e.target.value)}
        />
        <div style={{ marginTop: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>Upload Image/Diagram:</label>
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} />
        </div>
      </section>

      {/* Section 3: Audio */}
      <section style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
        <h2>Section 3: Oral Assessment</h2>
        {!recording ? (
          <button onClick={startRecording} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px' }}>
            Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} style={{ padding: '8px 16px', backgroundColor: '#343a40', color: '#fff', border: 'none', borderRadius: '4px' }}>
            Stop Recording
          </button>
        )}
        {audioUrl && (
          <div style={{ marginTop: '12px' }}>
            <p><strong>Playback Recording:</strong></p>
            <audio src={audioUrl} controls style={{ width: '100%' }} />
          </div>
        )}
      </section>

      {/* Submit Button */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={handleSubmitAll}
          disabled={submitting}
          style={{ padding: '12px 24px', backgroundColor: '#28a745', color: '#fff', fontSize: '18px', border: 'none', borderRadius: '4px', width: '100%' }}
        >
          {submitting ? 'Submitting...' : 'Submit Full Exam'}
        </button>
        {status && <p style={{ marginTop: '12px', fontWeight: 'bold' }}>{status}</p>}
      </div>
    </div>
  );
    }
  
