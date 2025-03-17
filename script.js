var toggleFlowButton = document.getElementById('toggle-flow');
var recordButtonC = document.getElementById('recordButtonContention');
var speakButtonAI = document.getElementById('SpeakAIContention');
var generateButtonAI = document.getElementById('GenerateAIContention')
var transcriptionResultC = document.getElementById('transcriptionContentionText');
var transcriptionResultR = document.getElementById('transcriptionRebuttalText')
var transcriptionResultS = document.getElementById('SummaryUserText');
var transcriptionResultF = document.getElementById('FFUserText')
var UserFlowDiv = document.getElementById('UserFlow');
var AIFlowDiv = document.getElementById('AIFlow');
var AIRebuttalButton = document.getElementById('speakAIRebuttal');
var GenerateAIRebuttalB = document.getElementById('GenerateAIRebuttal')
var recordButtonR = document.getElementById('recordButtonRebuttal');
var AISummarySpeakB = document.getElementById('SpeakAISummary');
var AISummaryGenerateB = document.getElementById('GenerateAISummary');
var AIFFSpeakB = document.getElementById('SpeakAIFF');
var AIFFGenerateB = document.getElementById('GenerateAIFF');
var recordButtonS = document.getElementById('recordButtonSummary');
var recordButtonF = document.getElementById('recordButtonFF');
var rebuttalFlowUpdated;
var ToggleisSelectedSide;
var recognition;
var recognitionR;
var recognitionS;
var recognitionF;
var isRecordingC = false;
var isRecordingR = false;
var isRecordingS = false;
var isRecordingF = false;
var fullTranscriptionContention = '';
var fullAIContentionRaw = '';
var fullAIRebuttal = '';
var fullTranscriptionRebuttal = '';
var fullTranscriptionSummary = '';
var fullTranscriptionFF = '';
let isSpeaking = false;
var isRebutting = false;
var isGenerating = false;
var isSpeakingR = false;
var isSpeakingS = false;
var isSpeakingF = false;
var isSummarying = false;
var isFFing = false;
let currentAudio = null;



document.addEventListener('DOMContentLoaded', function () {
    // Parse URL parameters
    const params = new URLSearchParams(window.location.search);
    // Retrieve the values of selectedSide and selectedTurn from URL parameters
    const selectedSide = params.get('selectedSide');
    const selectedTurn = params.get('selectedTurn');
    debateTopic = params.get('debateTopic'); // Assign to the global variable directly
    console.log("Debate Topic:", debateTopic);


    // Display the values in the desired location on the page
    document.getElementById('selectedSide').textContent = selectedSide;
    document.getElementById('selectedTurn').textContent = selectedTurn;


    // Update the other occurrence of selectedSide
    document.querySelector('.small-text span:last-of-type').textContent = selectedSide;

    // Set the first occurrence of selectedSide to the same value
    document.querySelector('#selectedSide').textContent = selectedSide;
    const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';

    // Check if the user is the second speaker
    if (selectedTurn.toLowerCase() === 'second') {
        // Add a CSS class to shift the transcriptionContention div to the right
        document.getElementById('transcriptionContention').classList.add('second-speaker');
        ToggleisSelectedSide = false;
        toggleFlowButton.textContent = 'Toggle ' + selectedSide;
        generateButtonAI.classList.add('glowing');

    } else {

        ToggleisSelectedSide = true;
        toggleFlowButton.textContent = 'Toggle ' + nonselectedSide;
        recordButtonC.classList.add('glowing');
    }


    updateFlowValues(selectedSide, nonselectedSide);

});
AISummaryGenerateB.addEventListener('click', () => {
    if (!isSummarying) {
        const selectedSide = document.getElementById('selectedSide').textContent;
        const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
        const transcription = fullTranscriptionContention;
        const transcriptionR = fullTranscriptionRebuttal;
        const transcriptionS = fullTranscriptionSummary;
        const AICase = document.getElementById('AIContentionText').innerHTML
        const AIRebuttal = document.getElementById('AIRebuttalText').innerHTML
        GenerateAISummary(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, transcriptionS, AICase, AIRebuttal);
        AISummaryGenerateB.textContent = 'Stop'; // Change button text to "Stop"
        isSummarying = true;
    } else {
        stopGeneratingAISummary();
        AISummaryGenerateB.textContent = 'Generate'; // Change button text back to "generate"
        isSummarying = false;
    }
});
AISummarySpeakB.addEventListener('click', () => {
    if (!isSpeakingS) {

        AISummarySpeakB.textContent = 'Stop';
        startSpeakingS();
    } else {
        AISummarySpeakB.textContent = 'Speak';
        stopSpeakingS();
    }

});
AIFFGenerateB.addEventListener('click', () => {
    if (!isFFing) {
        const selectedSide = document.getElementById('selectedSide').textContent;
        const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
        const transcription = fullTranscriptionContention;
        const transcriptionR = fullTranscriptionRebuttal;
        const transcriptionS = fullTranscriptionSummary;
        const AICase = document.getElementById('AIContentionText').innerHTML
        const AIRebuttal = document.getElementById('AIRebuttalText').innerHTML
        const AISummary = document.getElementById('AISummaryText').innerHTML
        GenerateAIFF(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, transcriptionS, AICase, AIRebuttal, AISummary);
        AIFFGenerateB.textContent = 'Stop'; // Change button text to "Stop"
        isFFing = true;
    } else {
        stopGeneratingAIFF();
        AIFFGenerateB.textContent = 'Generate'; // Change button text back to "generate"
        isFFing = false;
    }
});
AIFFSpeakB.addEventListener('click', () => {
    if (!isSpeakingF) {
        AIFFSpeakB.textContent = 'Stop';
        startSpeakingF();
    } else {
        AIFFSpeakB.textContent = 'Speak';
        stopSpeakingF();
    }

});
generateButtonAI.addEventListener('click', () => {
    if (!isGenerating) {
        const selectedSide = document.getElementById('selectedSide').textContent;
        const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
        const selectedSkill = document.getElementById('skillLevel').textContent
        startGenerating(debateTopic, nonselectedSide, selectedSkill);
        generateButtonAI.textContent = 'Stop'; // Change button text to "Stop"
        isGenerating = true;
    } else {
        stopGenerating();
        generateButtonAI.textContent = 'Generate'; // Change button text back to "generate"
        isGenerating = false;
    }
});
GenerateAIRebuttalB.addEventListener('click', () => {
    if (!isRebutting) {
        const selectedSide = document.getElementById('selectedSide').textContent;
        const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
        const transcription = fullTranscriptionContention;
        const transcriptionR = fullTranscriptionRebuttal
        GenerateAIRebuttal(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR);
        GenerateAIRebuttalB.textContent = 'Stop'; // Change button text to "Stop"
        isRebutting = true;
    } else {
        stopGeneratingAIRebuttal();
        GenerateAIRebuttalB.textContent = 'Generate'; // Change button text back to "Speak"
        isRebutting = false;
    }
});
speakButtonAI.addEventListener('click', () => {
    if (!isSpeaking) {
        speakButtonAI.textContent = 'Stop';
        startSpeaking();
    } else {
        speakButtonAI.textContent = 'Speak';
        stopSpeaking();
    }

});
AIRebuttalButton.addEventListener('click', () => {
    if (!isSpeakingR) {
        AIRebuttalButton.textContent = 'Stop';
        startSpeakingR();
    } else {
        AIRebuttalButton.textContent = 'Speak';
        stopSpeakingR();
    }

});
async function startSpeaking() {
    if (!isSpeaking) {
        let text = document.getElementById('AIContentionText').textContent;
        text = text.replace(/\[\d+\]/g, '');

        // Remove "Sources:" and everything that follows (works across multiple lines)
        text = text.replace(/Sources:[\s\S]*$/, '');
        const chunks = generateDynamicChunks(text, 10); 
        const audioQueue = [];

        // Fetch audio for each chunk
        for (let i = 0; i < chunks.length; i += 2) {
            const responses = await Promise.allSettled([
                fetchAudioFromServer(chunks[i]),
                chunks[i + 1] ? fetchAudioFromServer(chunks[i + 1]) : null
            ]);

            responses.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    audioQueue.push(result.value);
                }
            });

            // Start playing if queue has audio
            if (audioQueue.length > 0 && !isSpeaking) {
                playAudioQueue(audioQueue);
            }
        }
    }
}

async function fetchAudioFromServer(text) {
    try {
        const response = await fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/tts', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text: text },
                voice: {
                    languageCode: "en-US",
                    name: "en-US-Chirp3-HD-Orus"
                },
                audioConfig: {
                    audioEncoding: "LINEAR16",
                    pitch: 0,
                    speakingRate: 1.19,
                    effectsProfileId: ["small-bluetooth-speaker-class-device"]
                }
            }),
        });

        if (!response.ok) {
            console.error("TTS API error:", response.statusText);
            return null;
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error("Fetch error:", error);
        return null;
    }
}

function generateDynamicChunks(text, numChunks) {
    const words = text.split(' ');
    const totalWords = words.length;
    // Using a fixed distribution for 10 chunks; adjust if needed.
    const chunkPercents = [5, 7, 10, 12, 13, 15, 15, 10, 7, 6];
    let chunks = [];
    let start = 0;
  
    for (let i = 0; i < chunkPercents.length; i++) {
      if (start >= totalWords) break;
      // Calculate a target index based on the percentage
      let targetCount = Math.floor((chunkPercents[i] / 100) * totalWords);
      let targetIndex = start + targetCount;
      if (targetIndex >= totalWords) targetIndex = totalWords - 1;
  
      let boundary = targetIndex;
      let foundPeriod = false;
      
      // Search forward from targetIndex for the closest word containing a period.
      for (let j = targetIndex; j < totalWords; j++) {
        if (words[j].includes('.')) {
          boundary = j + 1; // Include the word with the period.
          foundPeriod = true;
          break;
        }
      }
      
      // If not found forward, search backward from targetIndex.
      if (!foundPeriod) {
        for (let j = targetIndex; j >= start; j--) {
          if (words[j].includes('.')) {
            boundary = j + 1;
            foundPeriod = true;
            break;
          }
        }
      }
      
      // If no period is found at all, use the target index.
      if (!foundPeriod) {
        boundary = targetIndex;
      }
      
      // Ensure we do not go past the end.
      if (boundary > totalWords) boundary = totalWords;
      
      // Create the chunk.
      const chunk = words.slice(start, boundary).join(' ');
      chunks.push(chunk);
      
      // Update start for the next chunk.
      start = boundary;
    }
    
    // If any words remain, append them to the final chunk.
    if (start < totalWords) {
      const remaining = words.slice(start).join(' ');
      if (chunks.length > 0) {
        chunks[chunks.length - 1] += ' ' + remaining;
      } else {
        chunks.push(remaining);
      }
    }
    
    return chunks;
  }
  

  function playAudioQueue(queue) {
    if (queue.length === 0) return;
    isSpeaking = true;

    const audio = new Audio(queue.shift());
    window.currentAudio = audio; // Save reference to the current audio
    audio.play();

    audio.onended = () => {
        if (queue.length > 0) {
            playAudioQueue(queue);
        } else {
            isSpeaking = false;
            window.currentAudio = null;
        }
    };
}
function playAudioQueueR(queue) {
    if (queue.length === 0) return;
    isSpeakingR = true;

    const audio = new Audio(queue.shift());
    window.currentAudio = audio; // Save reference to the current audio
    audio.play();

    audio.onended = () => {
        if (queue.length > 0) {
            playAudioQueue(queue);
        } else {
            isSpeakingR = false;
            window.currentAudio = null;
        }
    };
}
function playAudioQueueS(queue) {
    if (queue.length === 0) return;
    isSpeakingS = true;

    const audio = new Audio(queue.shift());
    window.currentAudio = audio; // Save reference to the current audio
    audio.play();

    audio.onended = () => {
        if (queue.length > 0) {
            playAudioQueue(queue);
        } else {
            isSpeakingS = false;
            window.currentAudio = null;
        }
    };
}
function playAudioQueueF(queue) {
    if (queue.length === 0) return;
    isSpeakingF = true;

    const audio = new Audio(queue.shift());
    window.currentAudio = audio; // Save reference to the current audio
    audio.play();

    audio.onended = () => {
        if (queue.length > 0) {
            playAudioQueue(queue);
        } else {
            isSpeakingF = false;
            window.currentAudio = null;
        }
    };
}

function stopSpeaking() {
    isSpeaking = false;
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
        window.currentAudio = null;
    }
}
function stopGenerating() {

}
function stopGeneratingAIRebuttal() {

}
function stopSpeakingR() {
    isSpeakingR = false;
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
        window.currentAudio = null;
    }

}
function stopSpeakingS() {
    isSpeakingS = false;
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
        window.currentAudio = null;
    }

}
function stopSpeakingF() {
    isSpeakingF = false;
    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.currentTime = 0;
        window.currentAudio = null;
    }

}

async function startSpeakingR() {
    if (!isSpeakingR) {
        let text = document.getElementById('AIRebuttalText').textContent;
        text = text.replace(/\[\d+\]/g, '');

        // Remove "Sources:" and everything that follows (works across multiple lines)
        text = text.replace(/Sources:[\s\S]*$/, '');
        const chunks = generateDynamicChunks(text, 10); 
        const audioQueue = [];

        // Fetch audio for each chunk
        for (let i = 0; i < chunks.length; i += 2) {
            const responses = await Promise.allSettled([
                fetchAudioFromServer(chunks[i]),
                chunks[i + 1] ? fetchAudioFromServer(chunks[i + 1]) : null
            ]);

            responses.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    audioQueue.push(result.value);
                }
            });

            // Start playing if queue has audio
            if (audioQueue.length > 0 && !isSpeakingR) {
                playAudioQueueR(audioQueue);
            }
        }
    }
}
async function startGenerating(debateTopic, nonselectedSide, selectedSkill) {
    generateButtonAI.classList.remove('glowing');
    fullAIContentionRaw = '';
    document.getElementById('AIContentionText').innerHTML = '';
    document.querySelector('.loading').style.display = 'block';
    document.querySelector('.text10').textContent = 'Generating Case (~15s)';

    try {
        // First API call to generate AI case
        const response1 = await fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/generate_ai_case', {
            method: 'POST',
            body: JSON.stringify({
                debateTopic: debateTopic,
                nonselectedSide: nonselectedSide,
                selectedSkill: selectedSkill
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response1.ok) {
            throw new Error('Failed to generate AI case');
        }

        const data1 = await response1.json();
        const AICase = data1.AICase;

        // Update loading text
        document.querySelector('.text10').textContent = 'Finding Sources (~10s)';

        // Second API call to get sources
        const response2 = await fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/get_sources', {
            method: 'POST',
            body: JSON.stringify({
                AICase: AICase
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response2.ok) {
            throw new Error('Failed to find sources');
        }

        const data2 = await response2.json();
        const modifiedAICase = data2.AICase;

        // Display the AI case with sources
        document.getElementById('AIContentionText').innerHTML = "<p>" + modifiedAICase.replace(/\n/g, '<br>') + "</p>";
    } catch (error) {
        console.error('Error processing user input:', error);
    } finally {
        // Hide the loading animation and reset UI elements
        document.querySelector('.loading').style.display = 'none';
        generateButtonAI.textContent = 'Generate';
        isGenerating = false;
        const selectedTurn = document.getElementById('selectedTurn').textContent;
        if (selectedTurn == "First") {
            recordButtonR.classList.add('glowing');
        }
        if (selectedTurn == "Second") {
            toggleFlowButton.classList.add('glowing');
            recordButtonC.classList.add('glowing');
        }
    }
}

toggleFlowButton.addEventListener('click', () => {
    const selectedSide = document.getElementById('selectedSide').textContent;
    const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
    if (toggleFlowButton.classList.contains('glowing')) {
        toggleFlowButton.classList.remove('glowing')
    }

    if (!ToggleisSelectedSide) {
        toggleFlowButton.textContent = 'Toggle ' + nonselectedSide;
        ToggleisSelectedSide = true;
    } else {
        toggleFlowButton.textContent = 'Toggle ' + selectedSide;
        ToggleisSelectedSide = false;
    }
    updateFlowValues(selectedSide, nonselectedSide);
});
function updateFlowValues(selectedSide, nonselectedSide) {
    if (ToggleisSelectedSide) {
        if (selectedSide === 'Aff') {
            document.getElementById('Flow1').textContent = selectedSide + 'irmative Flow';
        } else {
            document.getElementById('Flow1').textContent = selectedSide + 'ative Flow';
        }


        document.getElementById('Flow2').textContent = selectedSide;
        // Update the other occurrence of Flow2
        const otherFlow2Element = document.getElementById('AIContention').querySelector('#Flow2');
        otherFlow2Element.textContent = nonselectedSide;





        UserFlowDiv.style.display = 'block'; // Show the transcriptionContention div
        AIFlowDiv.style.display = 'none';
    } else {
        if (selectedSide === 'Aff') {
            document.getElementById('Flow1').textContent = nonselectedSide + 'ative Flow';
        } else {
            document.getElementById('Flow1').textContent = nonselectedSide + 'irmative Flow';
        }


        document.getElementById('Flow2').textContent = nonselectedSide;
        // Update the other occurrence of Flow2
        const otherFlow2Element = document.getElementById('transcriptionContention').querySelector('#Flow2');
        otherFlow2Element.textContent = selectedSide;





        UserFlowDiv.style.display = 'none'; // Hide the transcriptionContention div
        AIFlowDiv.style.display = 'block';
    }
}
recordButtonC.addEventListener('click', () => {
    if (!isRecordingC) { // If not currently recording, start recording
        startRecording();
        recordButtonC.textContent = 'Stop'; // Change button text to "Stop"
        isRecordingC = true;
    } else { // If currently recording, stop recording
        stopRecording();
        recordButtonC.textContent = 'Record'; // Change button text back to "Record"
        isRecordingC = false;
        transcriptionResultC.textContent = '';
    }
});
recordButtonR.addEventListener('click', () => {
    if (!isRecordingR) { // If not currently recording, start recording
        startRecordingR();
        recordButtonR.textContent = 'Stop'; // Change button text to "Stop"
        isRecordingR = true;
    } else { // If currently recording, stop recording
        stopRecordingR();
        recordButtonR.textContent = 'Record'; // Change button text back to "Record"
        isRecordingR = false;
        transcriptionResultR.textContent = '';
    }
});
recordButtonS.addEventListener('click', () => {
    if (!isRecordingS) { // If not currently recording, start recording
        startRecordingS();
        recordButtonS.textContent = 'Stop'; // Change button text to "Stop"
        isRecordingS = true;
    } else { // If currently recording, stop recording
        stopRecordingS();
        recordButtonS.textContent = 'Record'; // Change button text back to "Record"
        isRecordingS = false;
        transcriptionResultS.textContent = '';
    }
});
recordButtonF.addEventListener('click', () => {
    if (!isRecordingF) { // If not currently recording, start recording
        startRecordingF();
        recordButtonF.textContent = 'Stop'; // Change button text to "Stop"
        isRecordingF = true;
    } else { // If currently recording, stop recording
        stopRecordingF();
        recordButtonF.textContent = 'Record'; // Change button text back to "Record"
        isRecordingF = false;
        transcriptionResultF.textContent = '';
    }
});
function startRecording() {
    fullTranscriptionContention = ''; // Reset full transcription

    // Initialize speech recognition
    recognition = new webkitSpeechRecognition();
    recognition.lang = window.navigator.language;
    recognition.continuous = true; // Continuous listening
    recognition.interimResults = true; // Get interim results

    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth / 4;  // Set canvas width to a quarter of the window width
    canvas.height = window.innerHeight;

    // Get user's microphone input
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
            // Use the same stream for both the visualizer and speech recognition
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;  // Reduced the number of bars

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            source.connect(analyser);
            recordButtonC.classList.remove('glowing')
            function draw() {
                requestAnimationFrame(draw);

                analyser.getByteFrequencyData(dataArray);

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const cylinderWidth = 3;  // Half of the original width
                const spacing = cylinderWidth;  // One-third of the cylinder width
                const centerY = (canvas.height / 2) - (window.innerWidth / 10);

                // Draw cylinders on the right side (higher pitch on the right)
                let xRight = (canvas.width / 2) - (window.innerWidth / 90);
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i] / 4;

                    ctx.fillStyle = `rgb(53, 121, 246)`;

                    ctx.beginPath();
                    ctx.arc(xRight, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.arc(xRight, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillRect(xRight - cylinderWidth / 2, centerY - barHeight, cylinderWidth, barHeight * 2);

                    xRight += cylinderWidth + spacing;
                }

                // Mirror the right side to the left side
                ctx.save(); // Save the current context state
                ctx.translate(canvas.width / 2, 0); // Move the context to the center of the canvas
                ctx.scale(-1, 1); // Flip the context horizontally

                // Redraw the cylinders (now mirrored)
                let xLeft = 1 / 90 * window.innerWidth;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i] / 4;

                    ctx.fillStyle = `rgb(53, 121, 246)`;

                    ctx.beginPath();
                    ctx.arc(xLeft, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.arc(xLeft, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillRect(xLeft - cylinderWidth / 2, centerY - barHeight, cylinderWidth, barHeight * 2);

                    xLeft += cylinderWidth + spacing;
                }

                ctx.restore(); // Restore the context to its original state
            }

            draw();

            // Start speech recognition
            recognition.start();

            // Event listener for speech recognition results
            recognition.addEventListener('result', async (event) => {
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) { // Only handle final results
                        const transcript = result[0].transcript;
                        fullTranscriptionContention += transcript + ' '; // Append with space separator
                    }
                }
            });

            document.querySelector('.listeningC').style.display = 'block';

        })
        .catch(function (err) {
            console.error('Error accessing audio stream:', err);
        });
}
function startRecordingR() {
    fullTranscriptionRebuttal = ''
    // Initialize speech recognition
    recognitionR = new webkitSpeechRecognition();
    recognitionR.lang = window.navigator.language;

    recognitionR.continuous = true; // Continuous listening
    recognitionR.interimResults = true; // Get interim results
    const canvas = document.getElementById('visualizer1');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth / 4;  // Set canvas width to a quarter of the window width
    canvas.height = window.innerHeight;

    // Get user's microphone input
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
            // Use the same stream for both the visualizer and speech recognition
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;  // Reduced the number of bars

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            source.connect(analyser);
            recordButtonR.classList.remove('glowing')
            function draw() {
                requestAnimationFrame(draw);

                analyser.getByteFrequencyData(dataArray);

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const cylinderWidth = 3;  // Half of the original width
                const spacing = cylinderWidth;  // One-third of the cylinder width
                const centerY = (canvas.height / 2) - (window.innerWidth / 10);

                // Draw cylinders on the right side (higher pitch on the right)
                let xRight = (canvas.width / 2) - (window.innerWidth / 90);
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i] / 4;

                    ctx.fillStyle = `rgb(53, 121, 246)`;

                    ctx.beginPath();
                    ctx.arc(xRight, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.arc(xRight, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillRect(xRight - cylinderWidth / 2, centerY - barHeight, cylinderWidth, barHeight * 2);

                    xRight += cylinderWidth + spacing;
                }

                // Mirror the right side to the left side
                ctx.save(); // Save the current context state
                ctx.translate(canvas.width / 2, 0); // Move the context to the center of the canvas
                ctx.scale(-1, 1); // Flip the context horizontally

                // Redraw the cylinders (now mirrored)
                let xLeft = 1 / 90 * window.innerWidth;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i] / 4;

                    ctx.fillStyle = `rgb(53, 121, 246)`;

                    ctx.beginPath();
                    ctx.arc(xLeft, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.arc(xLeft, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillRect(xLeft - cylinderWidth / 2, centerY - barHeight, cylinderWidth, barHeight * 2);

                    xLeft += cylinderWidth + spacing;
                }

                ctx.restore(); // Restore the context to its original state
            }

            draw();

            recognitionR.start(); // Start recognition


            // Event listener for speech recognition results
            recognitionR.addEventListener('result', async (event) => {
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) { // Only handle final results
                        const transcript = result[0].transcript;
                        fullTranscriptionRebuttal += transcript + ' '; // Append with space separator


                    }
                }
            });
            document.querySelector('.listeningR').style.display = 'block';

        })
        .catch(function (err) {
            console.error('Error accessing audio stream:', err);
        });
}
function startRecordingS() {
    fullTranscriptionSummary = ''
    // Initialize speech recognition
    recognitionS = new webkitSpeechRecognition();
    recognitionS.lang = window.navigator.language;

    recognitionS.continuous = true; // Continuous listening
    recognitionS.interimResults = true; // Get interim results
    const canvas = document.getElementById('visualizer2');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth / 4;  // Set canvas width to a quarter of the window width
    canvas.height = window.innerHeight;

    // Get user's microphone input
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
            // Use the same stream for both the visualizer and speech recognition
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;  // Reduced the number of bars

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            source.connect(analyser);
            recordButtonS.classList.remove('glowing')
            function draw() {
                requestAnimationFrame(draw);

                analyser.getByteFrequencyData(dataArray);

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const cylinderWidth = 3;  // Half of the original width
                const spacing = cylinderWidth;  // One-third of the cylinder width
                const centerY = (canvas.height / 2) - (window.innerWidth / 10);

                // Draw cylinders on the right side (higher pitch on the right)
                let xRight = (canvas.width / 2) - (window.innerWidth / 90);
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i] / 4;

                    ctx.fillStyle = `rgb(53, 121, 246)`;

                    ctx.beginPath();
                    ctx.arc(xRight, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.arc(xRight, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillRect(xRight - cylinderWidth / 2, centerY - barHeight, cylinderWidth, barHeight * 2);

                    xRight += cylinderWidth + spacing;
                }

                // Mirror the right side to the left side
                ctx.save(); // Save the current context state
                ctx.translate(canvas.width / 2, 0); // Move the context to the center of the canvas
                ctx.scale(-1, 1); // Flip the context horizontally

                // Redraw the cylinders (now mirrored)
                let xLeft = 1 / 90 * window.innerWidth;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i] / 4;

                    ctx.fillStyle = `rgb(53, 121, 246)`;

                    ctx.beginPath();
                    ctx.arc(xLeft, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.arc(xLeft, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillRect(xLeft - cylinderWidth / 2, centerY - barHeight, cylinderWidth, barHeight * 2);

                    xLeft += cylinderWidth + spacing;
                }

                ctx.restore(); // Restore the context to its original state
            }

            draw();

            recognitionS.start(); // Start recognition


            // Event listener for speech recognition results
            recognitionS.addEventListener('result', async (event) => {
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) { // Only handle final results
                        const transcript = result[0].transcript;
                        fullTranscriptionSummary += transcript + ' '; // Append with space separator
                    }
                }
            });
            document.querySelector('.listeningS').style.display = 'block';

        })
        .catch(function (err) {
            console.error('Error accessing audio stream:', err);
        });
}
function startRecordingF() {
    fullTranscriptionFF = ''
    // Initialize speech recognition
    recognitionF = new webkitSpeechRecognition();
    recognitionF.lang = window.navigator.language;

    recognitionF.continuous = true; // Continuous listening
    recognitionF.interimResults = true; // Get interim results
    const canvas = document.getElementById('visualizer3');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth / 4;  // Set canvas width to a quarter of the window width
    canvas.height = window.innerHeight;

    // Get user's microphone input
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
            // Use the same stream for both the visualizer and speech recognition
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;  // Reduced the number of bars

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            source.connect(analyser);
            recordButtonF.classList.remove('glowing')
            function draw() {
                requestAnimationFrame(draw);

                analyser.getByteFrequencyData(dataArray);

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const cylinderWidth = 3;  // Half of the original width
                const spacing = cylinderWidth;  // One-third of the cylinder width
                const centerY = (canvas.height / 2) - (window.innerWidth / 10);

                // Draw cylinders on the right side (higher pitch on the right)
                let xRight = (canvas.width / 2) - (window.innerWidth / 90);
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i] / 4;

                    ctx.fillStyle = `rgb(53, 121, 246)`;

                    ctx.beginPath();
                    ctx.arc(xRight, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.arc(xRight, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillRect(xRight - cylinderWidth / 2, centerY - barHeight, cylinderWidth, barHeight * 2);

                    xRight += cylinderWidth + spacing;
                }

                // Mirror the right side to the left side
                ctx.save(); // Save the current context state
                ctx.translate(canvas.width / 2, 0); // Move the context to the center of the canvas
                ctx.scale(-1, 1); // Flip the context horizontally

                // Redraw the cylinders (now mirrored)
                let xLeft = 1 / 90 * window.innerWidth;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = dataArray[i] / 4;

                    ctx.fillStyle = `rgb(53, 121, 246)`;

                    ctx.beginPath();
                    ctx.arc(xLeft, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.arc(xLeft, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillRect(xLeft - cylinderWidth / 2, centerY - barHeight, cylinderWidth, barHeight * 2);

                    xLeft += cylinderWidth + spacing;
                }

                ctx.restore(); // Restore the context to its original state
            }

            draw();

            recognitionF.start(); // Start recognition


            // Event listener for speech recognition results
            recognitionF.addEventListener('result', async (event) => {
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) { // Only handle final results
                        const transcript = result[0].transcript;
                        fullTranscriptionFF += transcript + ' '; // Append with space separator

                    }
                }
            });
            document.querySelector('.listeningF').style.display = 'block';

        })
        .catch(function (err) {
            console.error('Error accessing audio stream:', err);
        });
}
function stopRecording() {
    if (recognition) {
        recognition.stop(); // Stop speech recognition
        document.querySelector('.listeningC').style.display = 'none';
        const selectedSide = document.getElementById('selectedSide').textContent;
        // Process the transcription to generate debate flow
        processTranscription(fullTranscriptionContention, debateTopic, selectedSide);
        const selectedTurn = document.getElementById('selectedTurn').textContent;
        if (selectedTurn == "Second") {
            GenerateAIRebuttalB.classList.add('glowing');
        }

        if (selectedTurn == "First") {

            toggleFlowButton.classList.add('glowing');
            generateButtonAI.classList.add('glowing');
        }

    }
}
function stopRecordingR() {
    if (recognitionR) {
        recognitionR.stop(); // Stop speech recognition
        document.querySelector('.listeningR').style.display = 'none';
        const selectedSide = document.getElementById('selectedSide').textContent;
        // Process the transcription to generate debate flow
        processTranscriptionR(fullTranscriptionRebuttal, debateTopic, selectedSide);
        const selectedTurn = document.getElementById('selectedTurn').textContent;
        if (selectedTurn == "Second") {
            AISummaryGenerateB.classList.add('glowing');
        }
        if (selectedTurn == "First") {
            toggleFlowButton.classList.add('glowing');
            GenerateAIRebuttalB.classList.add('glowing');
        }

    }
}
function stopRecordingS() {
    if (recognitionS) {
        recognitionS.stop(); // Stop speech recognition
        document.querySelector('.listeningS').style.display = 'none';
        const selectedSide = document.getElementById('selectedSide').textContent;
        // Process the transcription to generate debate flow
        processTranscriptionS(fullTranscriptionSummary, debateTopic, selectedSide);
        const selectedTurn = document.getElementById('selectedTurn').textContent;
        if (selectedTurn == "Second") {
            AIFFGenerateB.classList.add('glowing');
        }

        if (selectedTurn == "First") {

            toggleFlowButton.classList.add('glowing');
            AISummaryGenerateB.classList.add('glowing');
        }
    }
}
function stopRecordingF() {
    if (recognitionF) {
        recognitionF.stop(); // Stop speech recognition
        document.querySelector('.listeningF').style.display = 'none';
        const selectedSide = document.getElementById('selectedSide').textContent;
        // Process the transcription to generate debate flow
        transcriptionResultF.textContent = '';
        processTranscriptionF(fullTranscriptionFF, debateTopic, selectedSide);
        const selectedTurn = document.getElementById('selectedTurn').textContent;
        if (selectedTurn == "Second") {

        }

        if (selectedTurn == "First") {

            toggleFlowButton.classList.add('glowing');
            AIFFGenerateB.classList.add('glowing');
        }
    }
}
async function processTranscription(transcription, debateTopic, selectedSide) {
    document.querySelector('.loadingU').style.display = 'block';
    // Send the transcription to your Python backend for processing
    const response = await fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/processC', {
        method: 'POST', // Specify POST method
        body: JSON.stringify({
            transcription: transcription,
            debateTopic: debateTopic,
            selectedSide: selectedSide,
        }), // Send user input in the request body
        headers: {
            'Content-Type': 'application/json'
        }
    });


    if (response.ok) {

        // Get the debate flow from the response
        const { CaseFlow } = await response.json(); // Parse JSON response
        // Update the display with the generated debate flow

        transcriptionResultC.innerHTML = "<p>" + CaseFlow.replace(/\n/g, '<br>') + "</p>";
        document.querySelector('.loadingU').style.display = 'none';
    } else {
        console.error('Failed to process transcription:', response.statusText);
        document.querySelector('.loadingU').style.display = 'none';
    }
}
function processTranscriptionR(transcriptionR, debateTopic, selectedSide) {
    document.querySelector('.loadingRU').style.display = 'block';
    // Send the transcription to your Python backend for processing
    fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/processR', {
        method: 'POST', // Specify POST method
        body: JSON.stringify({
            transcriptionR: transcriptionR,
            debateTopic: debateTopic,
            selectedSide: selectedSide,
        }), // Send user input in the request body
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => {

            if (!response.ok) {
                throw new Error('Failed to process user input');
            }
            return response.json(); // Parse JSON response
        })
        .then(data => {

            // Get the debate flow from the response
            const { RebuttalFlow } = data; // Parse JSON response
            // Update the display with the generated debate flow
            transcriptionResultR.innerHTML = "<p>" + RebuttalFlow.replace(/\n/g, '<br>') + "</p>";
        
        })
        .catch(error => {
            console.error('Failed to process transcription:', error);
        })
        .finally(() => {
            // Hide the loading animation
            document.querySelector('.loadingRU').style.display = 'none';
        });
}
function processTranscriptionS(transcriptionS, debateTopic, selectedSide) {
    document.querySelector('.loadingSU').style.display = 'block';
    // Send the transcription to your Python backend for processing
    fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/processS', {
        method: 'POST', // Specify POST method
        body: JSON.stringify({
            transcriptionS: transcriptionS,
            debateTopic: debateTopic,
            selectedSide: selectedSide,
        }), // Send user input in the request body
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => {

            if (!response.ok) {
                throw new Error('Failed to process user input');
            }
            return response.json(); // Parse JSON response
        })
        .then(data => {

            // Get the debate flow from the response
            const { SummaryFlow } = data; // Parse JSON response
            // Update the display with the generated debate flow

            transcriptionResultS.innerHTML = "<p>" + SummaryFlow.replace(/\n/g, '<br>') + "</p>";

        })
        .catch(error => {
            console.error('Failed to process transcription:', error);
        })
        .finally(() => {
            // Hide the loading animation
            document.querySelector('.loadingSU').style.display = 'none';
        });
}
function processTranscriptionF(transcriptionF, debateTopic, selectedSide) {
    document.querySelector('.loadingFFU').style.display = 'block';
    // Send the transcription to your Python backend for processing
    transcriptionResultF.textContent = '';
    fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/processF', {
        method: 'POST', // Specify POST method
        body: JSON.stringify({
            transcriptionF: transcriptionF,
            debateTopic: debateTopic,
            selectedSide: selectedSide,
        }), // Send user input in the request body
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => {

            if (!response.ok) {
                throw new Error('Failed to process user input');
            }
            return response.json(); // Parse JSON response
        })
        .then(data => {

            // Get the debate flow from the response
            const { FinalFocusFlow } = data; // Parse JSON response
            // Update the display with the generated debate flow

            transcriptionResultF.innerHTML = "<p>" + FinalFocusFlow.replace(/\n/g, '<br>') + "</p>";

        })
        .catch(error => {
            console.error('Failed to process transcription:', error);
        })
        .finally(() => {
            // Hide the loading animation
            document.querySelector('.loadingFFU').style.display = 'none';
        });
}
function GenerateAIRebuttal(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR) {
    const selectedTurn = document.getElementById('selectedTurn').textContent;
    fullAIRebuttal = ''; // Reset full AI rebuttal
    GenerateAIRebuttalB.classList.remove('glowing');
    document.querySelector('.loadingRA').style.display = 'block';
    // Get the user's input from the text box
    // Send the user's input to the Python backend for processing
    if (selectedTurn == "First") {
        fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/secondrebuttal', {
            method: 'POST', // Specify POST method
            body: JSON.stringify({
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                transcription: transcription,
                transcriptionR: transcriptionR
            }), // Send user input in the request body
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => {

                if (!response.ok) {
                    throw new Error('Failed to process user input');
                }
                return response.json(); // Parse JSON response
            })
            .then(data => {

                // Get the AI response from the data
                const { AISecondRebuttal } = data;
                // Display the AI response
                document.getElementById('AIRebuttalText').innerHTML = "<p>" + AISecondRebuttal.replace(/\n/g, '<br>') + "</p>";

            })
            .catch(error => {
                console.error('Error processing user input:', error);
            })
            .finally(() => {
                // Hide the loading animation
                document.querySelector('.loadingRA').style.display = 'none';
                GenerateAIRebuttalB.textContent = 'Generate';
                recordButtonS.classList.add('glowing');

            });
    }
    if (selectedTurn == "Second") {
        fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/firstrebuttal', {
            method: 'POST', // Specify POST method
            body: JSON.stringify({
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                transcription: transcription,
            }), // Send user input in the request body
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => {

                if (!response.ok) {
                    throw new Error('Failed to process user input');
                }
                return response.json(); // Parse JSON response
            })
            .then(data => {

                // Get the AI response from the data
                const { AIFirstRebuttal } = data;
                // Display the AI response
                document.getElementById('AIRebuttalText').innerHTML = "<p>" + AIFirstRebuttal.replace(/\n/g, '<br>') + "</p>";

            })
            .catch(error => {
                console.error('Error processing user input:', error);
            })
            .finally(() => {
                // Hide the loading animation
                document.querySelector('.loadingRA').style.display = 'none';
                GenerateAIRebuttalB.textContent = 'Generate';
                toggleFlowButton.classList.add('glowing');
                recordButtonR.classList.add('glowing');

            });
    }

}
function GenerateAISummary(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, transcriptionS, AICase, AIRebuttal) {
    const selectedTurn = document.getElementById('selectedTurn').textContent;
    AISummaryGenerateB.classList.remove('glowing');
    document.querySelector('.loadingSA').style.display = 'block';
    // Get the user's input from the text box
    // Send the user's input to the Python backend for processing
    if (selectedTurn == "First") {
        fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/secondsummary', {
            method: 'POST', // Specify POST method
            body: JSON.stringify({
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                transcription: transcription,
                transcriptionR: transcriptionR,
                transcriptionS: transcriptionS,
                AICase: AICase,
                AIRebuttal: AIRebuttal

            }), // Send user input in the request body
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => {

                if (!response.ok) {
                    throw new Error('Failed to process user input');
                }
                return response.json(); // Parse JSON response
            })
            .then(data => {

                // Get the AI response from the data
                const { AISecondSummary } = data;
                // Display the AI response
                document.getElementById('AISummaryText').innerHTML = "<p>" + AISecondSummary.replace(/\n/g, '<br>') + "</p>";

            })
            .catch(error => {
                console.error('Error processing user input:', error);
            })
            .finally(() => {
                // Hide the loading animation
                document.querySelector('.loadingSA').style.display = 'none';
                AISummaryGenerateB.textContent = 'Generate';
                recordButtonF.classList.add('glowing');

            });
    }
    if (selectedTurn == "Second") {
        fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/firstsummary', {
            method: 'POST', // Specify POST method
            body: JSON.stringify({
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                transcription: transcription,
                transcriptionR: transcriptionR,
                AICase: AICase,
                AIRebuttal: AIRebuttal

            }), // Send user input in the request body
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => {

                if (!response.ok) {
                    throw new Error('Failed to process user input');
                }
                return response.json(); // Parse JSON response
            })
            .then(data => {

                // Get the AI response from the data
                const { AIFirstSummary } = data;
                // Display the AI response
                document.getElementById('AISummaryText').innerHTML = "<p>" + AIFirstSummary.replace(/\n/g, '<br>') + "</p>";

            })
            .catch(error => {
                console.error('Error processing user input:', error);
            })
            .finally(() => {
                // Hide the loading animation
                document.querySelector('.loadingSA').style.display = 'none';
                AISummaryGenerateB.textContent = 'Generate';
                toggleFlowButton.classList.add('glowing');
                recordButtonS.classList.add('glowing');

            });
    }

}
function GenerateAIFF(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, transcriptionS, AICase, AIRebuttal, AISummary) {
    AIFFGenerateB.classList.remove('glowing');
    document.querySelector('.loadingFFA').style.display = 'block';
    fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/finalfocus', {
        method: 'POST', // Specify POST method
        body: JSON.stringify({
            debateTopic: debateTopic,
            selectedSide: selectedSide,
            nonselectedSide: nonselectedSide,
            transcription: transcription,
            transcriptionR: transcriptionR,
            transcriptionS: transcriptionS,
            AICase: AICase,
            AIRebuttal: AIRebuttal,
            AISummary: AISummary
        }), // Send user input in the request body
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => {

            if (!response.ok) {
                throw new Error('Failed to process user input');
            }
            return response.json(); // Parse JSON response
        })
        .then(data => {
            // Get the AI response from the data
            const { AIFinalFocus } = data;


            // Display the AI response
            document.getElementById('AIFFText').innerHTML = "<p>" + AIFinalFocus.replace(/\n/g, '<br>') + "</p>";
        })
        .catch(error => {
            console.error('Error processing user input:', error);
        })
        .finally(() => {
            // Hide the loading animation
            document.querySelector('.loadingFFA').style.display = 'none';
            AIFFGenerateB.textContent = 'Generate';
            const selectedTurn = document.getElementById('selectedTurn').textContent;
            if (selectedTurn == "Second") {
                toggleFlowButton.classList.add('glowing');
                recordButtonF.classList.add('glowing');
            }
        });
}
function stopGeneratingAISummary() {

}
function stopGeneratingAIFF() {

}

async function startSpeakingS() {
    if (!isSpeakingS) {
        let text = document.getElementById('AISummaryText').textContent;
        text = text.replace(/\[\d+\]/g, '');

        // Remove "Sources:" and everything that follows (works across multiple lines)
        text = text.replace(/Sources:[\s\S]*$/, '');
        const chunks = generateDynamicChunks(text, 10); 
        const audioQueue = [];

        // Fetch audio for each chunk
        for (let i = 0; i < chunks.length; i += 2) {
            const responses = await Promise.allSettled([
                fetchAudioFromServer(chunks[i]),
                chunks[i + 1] ? fetchAudioFromServer(chunks[i + 1]) : null
            ]);

            responses.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    audioQueue.push(result.value);
                }
            });

            // Start playing if queue has audio
            if (audioQueue.length > 0 && !isSpeakingS) {
                playAudioQueueS(audioQueue);
            }
        }
    }
}
async function startSpeakingF() {
    if (!isSpeakingF) {
        let text = document.getElementById('AIFFText').textContent;
        text = text.replace(/\[\d+\]/g, '');

        // Remove "Sources:" and everything that follows (works across multiple lines)
        text = text.replace(/Sources:[\s\S]*$/, '');
        const chunks = generateDynamicChunks(text, 10); 
        const audioQueue = [];

        // Fetch audio for each chunk
        for (let i = 0; i < chunks.length; i += 2) {
            const responses = await Promise.allSettled([
                fetchAudioFromServer(chunks[i]),
                chunks[i + 1] ? fetchAudioFromServer(chunks[i + 1]) : null
            ]);

            responses.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    audioQueue.push(result.value);
                }
            });

            // Start playing if queue has audio
            if (audioQueue.length > 0 && !isSpeakingF) {
                playAudioQueueF(audioQueue);
            }
        }
    }
}
