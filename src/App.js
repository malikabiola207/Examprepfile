import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [scoreResult, setScoreResult] = useState(null);

  // Initialize Gemini client using the environment key
  const ai = new GoogleGenAI({ apiKey: process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY });

  const handleFileUpload = (e) => {
    setFile(e.target.files[0]);
  };

  // Convert uploaded file to base64 for Gemini ingestion
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const generateQuizFromPDF = async () => {
    if (!file) {
      alert('Please select a PDF file first.');
      return;
    }

    setLoading(true);
    try {
      const base64Data = await fileToBase64(file);

      const prompt = `Analyze this document and generate a structured interactive quiz containing up to 200 questions (or as many as appropriate based on the content). 
      Include a mix of Multiple Choice Questions (with 4 options and correct_answer specified) and Theory/Essay questions. 
      Assign a percentage weight to each question so that all weights add up to 100%.
      Return ONLY valid JSON matching this structure:
      {
        "title": "Exam Title",
        "questions": [
          {
            "id": 1,
            "type": "mcq",
            "question": "Question text here?",
            "options": ["A", "B", "C", "D"],
            "correct_answer": "A",
            "weight_percentage": 5
          },
          {
            "id": 2,
            "type": "essay",
            "question": "Essay prompt here?",
            "weight_percentage": 10
          }
        ]
      }`;

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: file.type || 'application/pdf'
            }
          },
          prompt
        ]
      });

      let text = response.text;
      // Clean up markdown block quotes if returned by model
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(text);
      setQuizData(parsed);
    } catch (err) {
      console.error(err);
      alert('Error generating quiz from PDF. Please check your API key and file.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (questionId, option) => {
    setUserAnswers({ ...userAnswers, [questionId]: option });
  };

  const calculateScore = () => {
    if (!quizData) return;
    let earnedScore = 0;

    quizData.questions.forEach((q) => {
      if (q.type === 'mcq') {
        if (userAnswers[q.id] === q.correct_answer) {
          earnedScore += q.weight_percentage || 0;
        }
      }
    });

    setScoreResult(earnedScore);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>AI Exam & Quiz Generator</h1>
      
      {!quizData ? (
        <div style={{ border: '2px dashed #ccc', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h3>Upload PDF Material (Up to 200 Questions)</h3>
          <input type="file" accept="application/pdf" onChange={handleFileUpload} style={{ margin: '15px 0' }} />
          <br />
          <button 
            onClick={generateQuizFromPDF} 
            disabled={loading}
            style={{ background: '#0070f3', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            {loading ? 'Analyzing PDF & Generating Quiz...' : 'Generate AI Quiz'}
          </button>
        </div>
      ) : (
        <div>
          <h2>{quizData.title || 'Generated Examination'}</h2>
          {quizData.questions.map((q, index) => (
            <div key={q.id || index} style={{ background: '#f9f9f9', padding: '15px', marginBottom: '15px', borderRadius: '6px' }}>
              <p><strong>Q{index + 1}:</strong> {q.question} <span style={{ float: 'right', color: '#666', fontSize: '12px' }}>[{q.weight_percentage}%]</span></p>
              
              {q.type === 'mcq' ? (
                q.options.map((opt, i) => (
                  <label key={i} style={{ display: 'block', margin: '5px 0', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name={`question_${q.id}`} 
                      value={opt}
                      checked={userAnswers[q.id] === opt}
                      onChange={() => handleOptionChange(q.id, opt)}
                    /> {opt}
                  </label>
                ))
              ) : (
                <textarea 
                  placeholder="Write your essay answer here..."
                  rows="4"
                  style={{ width: '100%', padding: '8px' }}
                  onChange={(e) => handleOptionChange(q.id, e.target.value)}
                />
              )}
            </div>
          ))}

          <button 
            onClick={calculateScore}
            style={{ background: '#28a745', color: '#fff', padding: '12px 24px', border: 'none', borderRadius: '5px', fontSize: '16px', cursor: 'pointer', width: '100%' }}
          >
            Submit Exam & Calculate Grade
          </button>

          {scoreResult !== null && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#e2f0d9', borderRadius: '5px', textAlign: 'center' }}>
              <h3>Exam Graded Successfully!</h3>
              <h2>Final Score: {scoreResult}%</h2>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
