var toggleFlowButton = document.getElementById('toggle-flow');
var generateFeedbackButton = document.getElementById('download-btn')
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
let mediaRecorder;
let audioChunks = [];
let audioStream;
let animationFrame;
let recordingStartTime;
var judgeType = 'tech';
var roundOver;

let __roundSavedToProfile = false;
var __savedRoundKey = null;

function getDebateTopicSafe(){
  try { return (typeof debateTopic !== "undefined" && debateTopic) ? debateTopic
             : (new URLSearchParams(location.search).get('debateTopic') || 'Untitled Topic'); }
  catch { return 'Untitled Topic'; }
}

function pfHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
}

document.addEventListener('DOMContentLoaded', function () {
    // Parse URL parameters
    const params = new URLSearchParams(window.location.search);

    // Get all parameters
    const selectedSide = params.get('selectedSide');
    const selectedTurn = params.get('selectedTurn');
    const selectedSkill = params.get('selectedSkill');
    debateTopic = params.get('debateTopic');

    // A round needs all four settings; anything else goes back to setup.
    const validRound =
        (selectedSide === 'Aff' || selectedSide === 'Neg') &&
        (selectedTurn === 'First' || selectedTurn === 'Second') &&
        (selectedSkill === 'middle' || selectedSkill === 'high') &&
        typeof debateTopic === 'string' && debateTopic.trim() !== '' && debateTopic.length <= 500;
    if (!validRound) {
        location.replace('setup.html?error=missing-params');
        return;
    }

    // Set text content for ALL parameters
    document.getElementById('selectedSide').textContent = selectedSide;
    document.getElementById('selectedTurn').textContent = selectedTurn;
    document.getElementById('selectedSkill').textContent = selectedSkill;
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

    // Entering a round requires an account; the saved round is per user and
    // per round settings, so both wait on auth.
    if (!window.pfGate) return;
    pfGate.requireAuth({ page: 'Flow' }).then(function (ok) {
        if (!ok) return;
        return pfGate.authUser().then(function (user) {
            if (!user) return;
            __savedRoundKey = 'savedRound::' + user.uid + '::' +
                pfHash(debateTopic + '|' + selectedSide + '|' + selectedTurn);
            restoreSavedRound(selectedSide, nonselectedSide);
        });
    });

});

function restoreSavedRound(selectedSide, nonselectedSide) {
    const savedState = localStorage.getItem(__savedRoundKey);
    if (!savedState) return; // No saved data

    let state;
    try { state = JSON.parse(savedState); } catch (e) { return; }

    // Restore text content
    document.getElementById('AIContentionText').innerHTML = state.AICase || '';
    document.getElementById('AIRebuttalText').innerHTML = state.AIRebuttal || '';
    document.getElementById('AISummaryText').innerHTML = state.AISummary || '';
    document.getElementById('AIFFText').innerHTML = state.AIFF || '';

    // Restore flow content
    transcriptionResultC.innerHTML = state.ContentionFlow || '';
    transcriptionResultR.innerHTML = state.RebuttalFlow || '';
    transcriptionResultS.innerHTML = state.SummaryFlow || '';
    transcriptionResultF.innerHTML = state.FFFlow || '';

    // Restore full transcriptions
    fullTranscriptionContention = state.transcriptionC || '';
    fullTranscriptionRebuttal = state.transcriptionR || '';
    fullTranscriptionSummary = state.transcriptionS || '';
    fullTranscriptionFF = state.transcriptionF || '';

    document.getElementById('feedback-content').innerHTML = state.feedback || '';

    // Restore turn progress
    if (typeof state.toggle === 'boolean') {
        ToggleisSelectedSide = state.toggle;
        toggleFlowButton.textContent = 'Toggle ' + (ToggleisSelectedSide ? nonselectedSide : selectedSide);
        updateFlowValues(selectedSide, nonselectedSide);
    }
    __roundSavedToProfile = !!state.savedToProfile;

    updateResultsVisibility()
    console.log('Round auto-loaded!');
}
AISummaryGenerateB.addEventListener('click', async () => {
    if (!isSummarying) {
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
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
AISummarySpeakB.addEventListener('click', async () => {
    if (!isSpeakingS) {
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        AISummarySpeakB.textContent = 'Stop';
        startSpeakingS();
    } else {
        AISummarySpeakB.textContent = 'Speak';
        stopSpeakingS();
    }


});
AIFFGenerateB.addEventListener('click', async () => {
    if (!isFFing) {
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
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
AIFFSpeakB.addEventListener('click', async () => {
    if (!isSpeakingF) {
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        AIFFSpeakB.textContent = 'Stop';
        startSpeakingF();
    } else {
        AIFFSpeakB.textContent = 'Speak';
        stopSpeakingF();
    }


});
generateButtonAI.addEventListener('click', async () => {
    if (!isGenerating) {
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        const selectedSide = document.getElementById('selectedSide').textContent;
        const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
        const selectedSkill = document.getElementById('selectedSkill').textContent;
        startGenerating(debateTopic, nonselectedSide, selectedSkill);
        generateButtonAI.textContent = 'Stop'; // Change button text to "Stop"
        isGenerating = true;
    } else {
        stopGenerating();
        generateButtonAI.textContent = 'Generate'; // Change button text back to "generate"
        isGenerating = false;
    }
});
GenerateAIRebuttalB.addEventListener('click', async () => {
    if (!isRebutting) {
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        const selectedSide = document.getElementById('selectedSide').textContent;
        const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
        const transcription = fullTranscriptionContention;
        const transcriptionR = fullTranscriptionRebuttal;
        const selectedSkill = document.getElementById('selectedSkill').textContent;
        GenerateAIRebuttal(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, selectedSkill);
        GenerateAIRebuttalB.textContent = 'Stop'; // Change button text to "Stop"
        isRebutting = true;
    } else {
        stopGeneratingAIRebuttal();
        GenerateAIRebuttalB.textContent = 'Generate'; // Change button text back to "Speak"
        isRebutting = false;
    }
});
speakButtonAI.addEventListener('click', async () => {
    if (!isSpeaking) {
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        speakButtonAI.textContent = 'Stop';
        startSpeaking();
    } else {
        speakButtonAI.textContent = 'Speak';
        stopSpeaking();
    }


});
AIRebuttalButton.addEventListener('click', async () => {
    if (!isSpeakingR) {
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
        AIRebuttalButton.textContent = 'Stop';
        startSpeakingR();
    } else {
        AIRebuttalButton.textContent = 'Speak';
        stopSpeakingR();
    }


});
async function startSpeaking() {
    if (!isSpeaking) {
        await speakFromElement('AIContentionText', () => isSpeaking, playAudioQueue);
    }
}


// One /tts call covers a whole speech; only text past the 6,000-char cap
// gets a second chunk.
function splitForTTS(text) {
    const MAX = 6000;
    const chunks = [];
    let rest = text;
    while (rest.length > MAX) {
        let cut = rest.lastIndexOf('. ', MAX);
        if (cut < MAX / 2) cut = rest.lastIndexOf(' ', MAX);
        if (cut <= 0) cut = MAX;
        else cut += 1;
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut);
    }
    if (rest.trim() !== '') chunks.push(rest);
    return chunks;
}


async function speakFromElement(elementId, isActive, playQueue) {
    let text = document.getElementById(elementId).textContent;
    text = text.replace(/\[\d+\]/g, '');


    // Remove "Sources:" and everything that follows (works across multiple lines)
    text = text.replace(/Sources:[\s\S]*$/, '');
    const chunks = splitForTTS(text);
    const audioQueue = [];


    for (const chunk of chunks) {
        const url = await fetchAudioFromServer(chunk);
        if (url) audioQueue.push(url);


        // Start playing if queue has audio
        if (audioQueue.length > 0 && !isActive()) {
            playQueue(audioQueue);
        }
    }
}


async function fetchAudioFromServer(text) {
    // On a per-user 429, wait out Retry-After and try again rather than
    // dropping the audio.
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await pfFetch('/tts', {
                json: {
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
                }
            }, { page: 'Flow', retry429: true });

            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (error) {
            if (error && error.code === 'rate_limited' && error.scope !== 'global' && attempt < 2) {
                await new Promise(r => setTimeout(r, Math.min(error.retryAfter || 30, 120) * 1000));
                continue;
            }
            console.error("TTS error:", error);
            return null;
        }
    }
    return null;
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
            playAudioQueueR(queue);
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
            playAudioQueueS(queue);
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
            playAudioQueueF(queue);
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
        await speakFromElement('AIRebuttalText', () => isSpeakingR, playAudioQueueR);
    }
}
async function startGenerating(debateTopic, nonselectedSide, selectedSkill) {
    generateButtonAI.classList.remove('glowing');
    fullAIContentionRaw = '';
    document.getElementById('AIContentionText').innerHTML = '';
    document.querySelector('#AIContention .loading').style.display = 'block';
    // Update text within AIContention's loading
    document.querySelector('#AIContention .text10').textContent = 'Generating Case (~15s)';


    try {
        // First API call to generate AI case
        const response1 = await pfFetch('/generate_ai_case', {
            json: {
                debateTopic: debateTopic,
                nonselectedSide: nonselectedSide,
                selectedSkill: selectedSkill
            }
        }, { page: 'Flow', button: generateButtonAI, label: 'Generate' });


        const data1 = await response1.json();
        const AICase = data1.AICase;


        // Update loading text
        document.querySelector('#AIContention .text10').textContent = 'Finding Sources (~10s)';


        // Second API call to get sources
        const response2 = await pfFetch('/get_sources', {
            json: {
                AICase: AICase
            }
        }, { page: 'Flow', button: generateButtonAI, label: 'Generate' });


        const data2 = await response2.json();
        const modifiedAICase = data2.AICase;


        // Display the AI case with sources
        document.getElementById('AIContentionText').innerHTML = "<p>" + pfSanitize(modifiedAICase) + "</p>";
    } catch (error) {
        console.error('Error processing user input:', error);
    } finally {
        // Hide the loading animation and reset UI elements
        document.querySelector('#AIContention .loading').style.display = 'none';
        generateButtonAI.textContent = 'Generate';
        isGenerating = false;
        const selectedTurn = document.getElementById('selectedTurn').textContent;
        saveRound()
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
recordButtonC.addEventListener('click', async () => {
    if (!isRecordingC) { // If not currently recording, start recording
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
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
recordButtonR.addEventListener('click', async () => {
    if (!isRecordingR) { // If not currently recording, start recording
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
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
recordButtonS.addEventListener('click', async () => {
    if (!isRecordingS) { // If not currently recording, start recording
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
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
recordButtonF.addEventListener('click', async () => {
    if (!isRecordingF) { // If not currently recording, start recording
        if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
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
async function startRecording() {
    // Reset audio chunks and transcription
    audioChunks = [];
    fullTranscriptionContention = '';
    transcriptionResultC.innerHTML = ''


    // Visualization setup
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth / 4;
    canvas.height = window.innerHeight;


    try {
        // Get audio stream and set up visualization
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(audioStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;


        // Audio analysis setup
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        source.connect(analyser);


        // Remove record button glow
        recordButtonC.classList.remove('glowing');


        // Visualization animation
        function draw() {
            requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);


            ctx.clearRect(0, 0, canvas.width, canvas.height);


            const cylinderWidth = 3;
            const spacing = cylinderWidth;
            const centerY = (canvas.height / 2) - (window.innerWidth / 10);


            // Right side visualization
            let xRight = (canvas.width / 2) - (window.innerWidth / 90);
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw top and bottom circles
                ctx.beginPath();
                ctx.arc(xRight, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xRight, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                // Draw vertical bar
                ctx.fillRect(
                    xRight - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xRight += cylinderWidth + spacing;
            }


            // Mirror left side visualization
            ctx.save();
            ctx.translate(canvas.width / 2, 0);
            ctx.scale(-1, 1);


            let xLeft = 1 / 90 * window.innerWidth;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw mirrored elements
                ctx.beginPath();
                ctx.arc(xLeft, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xLeft, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                ctx.fillRect(
                    xLeft - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xLeft += cylinderWidth + spacing;
            }


            ctx.restore();
        }


        // Start visualization
        draw();


        // Setup audio recording
        mediaRecorder = new MediaRecorder(audioStream);
        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };
        mediaRecorder.start();
        recordingStartTime = Date.now();

        // Show listening animation
        document.querySelector('.listeningC').style.display = 'block';


    } catch (err) {
        console.error('Error accessing audio stream:', err);
        // Handle microphone access errors here
    }
}
async function startRecordingR() {
    // Reset audio chunks and transcription
    audioChunks = [];
    fullTranscriptionRebuttal = '';
    transcriptionResultR.innerHTML = ''


    // Visualization setup
    const canvas = document.getElementById('visualizer1');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth / 4;
    canvas.height = window.innerHeight;


    try {
        // Get audio stream and set up visualization
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(audioStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;


        // Audio analysis setup
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        source.connect(analyser);


        // Remove record button glow
        recordButtonR.classList.remove('glowing');


        // Visualization animation
        function draw() {
            requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);


            ctx.clearRect(0, 0, canvas.width, canvas.height);


            const cylinderWidth = 3;
            const spacing = cylinderWidth;
            const centerY = (canvas.height / 2) - (window.innerWidth / 10);


            // Right side visualization
            let xRight = (canvas.width / 2) - (window.innerWidth / 90);
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw top and bottom circles
                ctx.beginPath();
                ctx.arc(xRight, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xRight, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                // Draw vertical bar
                ctx.fillRect(
                    xRight - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xRight += cylinderWidth + spacing;
            }


            // Mirror left side visualization
            ctx.save();
            ctx.translate(canvas.width / 2, 0);
            ctx.scale(-1, 1);


            let xLeft = 1 / 90 * window.innerWidth;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw mirrored elements
                ctx.beginPath();
                ctx.arc(xLeft, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xLeft, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                ctx.fillRect(
                    xLeft - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xLeft += cylinderWidth + spacing;
            }


            ctx.restore();
        }


        // Start visualization
        draw();


        // Setup audio recording
        mediaRecorder = new MediaRecorder(audioStream);
        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };
        mediaRecorder.start();
        recordingStartTime = Date.now();


        // Show listening animation
        document.querySelector('.listeningR').style.display = 'block';


    } catch (err) {
        console.error('Error accessing audio stream:', err);
        // Handle microphone access errors here
    }
}
async function startRecordingS() {
    // Reset audio chunks and transcription
    audioChunks = [];
    fullTranscriptionSummary = '';
    transcriptionResultS.innerHTML = ''


    // Visualization setup
    const canvas = document.getElementById('visualizer2');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth / 4;
    canvas.height = window.innerHeight;


    try {
        // Get audio stream and set up visualization
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(audioStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;


        // Audio analysis setup
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        source.connect(analyser);


        // Remove record button glow
        recordButtonS.classList.remove('glowing');


        // Visualization animation
        function draw() {
            requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);


            ctx.clearRect(0, 0, canvas.width, canvas.height);


            const cylinderWidth = 3;
            const spacing = cylinderWidth;
            const centerY = (canvas.height / 2) - (window.innerWidth / 10);


            // Right side visualization
            let xRight = (canvas.width / 2) - (window.innerWidth / 90);
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw top and bottom circles
                ctx.beginPath();
                ctx.arc(xRight, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xRight, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                // Draw vertical bar
                ctx.fillRect(
                    xRight - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xRight += cylinderWidth + spacing;
            }


            // Mirror left side visualization
            ctx.save();
            ctx.translate(canvas.width / 2, 0);
            ctx.scale(-1, 1);


            let xLeft = 1 / 90 * window.innerWidth;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw mirrored elements
                ctx.beginPath();
                ctx.arc(xLeft, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xLeft, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                ctx.fillRect(
                    xLeft - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xLeft += cylinderWidth + spacing;
            }


            ctx.restore();
        }


        // Start visualization
        draw();


        // Setup audio recording
        mediaRecorder = new MediaRecorder(audioStream);
        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };
        mediaRecorder.start();
        recordingStartTime = Date.now();


        // Show listening animation
        document.querySelector('.listeningS').style.display = 'block';


    } catch (err) {
        console.error('Error accessing audio stream:', err);
        // Handle microphone access errors here
    }
}


async function startRecordingF() {
    // Reset audio chunks and transcription
    audioChunks = [];
    fullTranscriptionFF = '';
    transcriptionResultF.innerHTML = ''


    // Visualization setup
    const canvas = document.getElementById('visualizer3');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth / 4;
    canvas.height = window.innerHeight;


    try {
        // Get audio stream and set up visualization
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(audioStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;


        // Audio analysis setup
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        source.connect(analyser);


        // Remove record button glow
        recordButtonF.classList.remove('glowing');


        // Visualization animation
        function draw() {
            requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);


            ctx.clearRect(0, 0, canvas.width, canvas.height);


            const cylinderWidth = 3;
            const spacing = cylinderWidth;
            const centerY = (canvas.height / 2) - (window.innerWidth / 10);


            // Right side visualization
            let xRight = (canvas.width / 2) - (window.innerWidth / 90);
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw top and bottom circles
                ctx.beginPath();
                ctx.arc(xRight, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xRight, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                // Draw vertical bar
                ctx.fillRect(
                    xRight - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xRight += cylinderWidth + spacing;
            }


            // Mirror left side visualization
            ctx.save();
            ctx.translate(canvas.width / 2, 0);
            ctx.scale(-1, 1);


            let xLeft = 1 / 90 * window.innerWidth;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = `rgb(53, 121, 246)`;


                // Draw mirrored elements
                ctx.beginPath();
                ctx.arc(xLeft, centerY - barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.arc(xLeft, centerY + barHeight, cylinderWidth / 2, 0, Math.PI * 2);
                ctx.fill();


                ctx.fillRect(
                    xLeft - cylinderWidth / 2,
                    centerY - barHeight,
                    cylinderWidth,
                    barHeight * 2
                );


                xLeft += cylinderWidth + spacing;
            }


            ctx.restore();
        }


        // Start visualization
        draw();


        // Setup audio recording
        mediaRecorder = new MediaRecorder(audioStream);
        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };
        mediaRecorder.start();
        recordingStartTime = Date.now();


        // Show listening animation
        document.querySelector('.listeningF').style.display = 'block';


    } catch (err) {
        console.error('Error accessing audio stream:', err);
        // Handle microphone access errors here
    }
}


async function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        cancelAnimationFrame(animationFrame);

        mediaRecorder.onstop = async () => {
            document.querySelector('.listeningC').style.display = 'none';

            const durationSeconds = (Date.now() - recordingStartTime) / 1000;

            if (durationSeconds < 10) {
                // Hide loading and show error message

                transcriptionResultC.innerHTML = 'Please record a full public forum debate case';

                // Cleanup audio resources
                audioStream.getTracks().forEach(track => track.stop());
                return; // Exit early without backend request
            }

            document.querySelector('.loading0U').style.display = 'block';
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

            try {
                // Send to your backend endpoint instead of Deepgram directly
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');


                const response = await pfFetch('/transcribe', { formData: formData },
                    { page: 'Flow', button: recordButtonC, label: 'Record' });

                const { transcript } = await response.json();
                fullTranscriptionContention = transcript;
                // Rest of your existing processing code
                const selectedSide = document.getElementById('selectedSide').textContent;
                processTranscription(transcript, debateTopic, selectedSide);

                // UI handling remains the same
                const selectedTurn = document.getElementById('selectedTurn').textContent;
                if (selectedTurn === "Second") {
                    GenerateAIRebuttalB.classList.add('glowing');
                } else if (selectedTurn === "First") {
                    toggleFlowButton.classList.add('glowing');
                    generateButtonAI.classList.add('glowing');
                }

            } catch (error) {
                console.error('Transcription error:', error);
                document.querySelector('.loading0U').style.display = 'none';
                // Handle error state
            }

            audioStream.getTracks().forEach(track => track.stop());

        };
    }

}




async function stopRecordingR() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        cancelAnimationFrame(animationFrame);

        mediaRecorder.onstop = async () => {
            document.querySelector('.listeningR').style.display = 'none';


            const durationSeconds = (Date.now() - recordingStartTime) / 1000;

            if (durationSeconds < 10) {
                // Hide loading and show error message

                transcriptionResultR.innerHTML = 'Please record a full public forum debate rebuttal';
                saveRound()
                // Cleanup audio resources
                audioStream.getTracks().forEach(track => track.stop());
                return; // Exit early without backend request
            }

            document.querySelector('.loading1U').style.display = 'block';
            // Create audio blob
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });



            try {
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');


                const response = await pfFetch('/transcribe', { formData: formData },
                    { page: 'Flow', button: recordButtonR, label: 'Record' });

                const { transcript } = await response.json();

                fullTranscriptionRebuttal = transcript;

                const selectedSide = document.getElementById('selectedSide').textContent;
                processTranscriptionR(transcript, debateTopic, selectedSide);
                saveRound()

                // Handle UI elements
                const selectedTurn = document.getElementById('selectedTurn').textContent;
                if (selectedTurn === "Second") {
                    AISummaryGenerateB.classList.add('glowing');
                } else if (selectedTurn === "First") {
                    toggleFlowButton.classList.add('glowing');
                    GenerateAIRebuttalB.classList.add('glowing');
                }


            } catch (error) {
                console.error('Transcription error:', error);
                document.querySelector('.loading1U').style.display = 'none';
                // Handle error state here
            }


            // Cleanup audio resources
            audioStream.getTracks().forEach(track => track.stop());
        };
    }
}
async function stopRecordingS() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        cancelAnimationFrame(animationFrame);

        mediaRecorder.onstop = async () => {
            document.querySelector('.listeningS').style.display = 'none';

            const durationSeconds = (Date.now() - recordingStartTime) / 1000;

            if (durationSeconds < 10) {
                // Hide loading and show error message

                transcriptionResultS.innerHTML = 'Please record a full public forum debate summary';
                saveRound()
                // Cleanup audio resources
                audioStream.getTracks().forEach(track => track.stop());
                return; // Exit early without backend request
            }

            document.querySelector('.loading2U').style.display = 'block';

            // Create audio blob
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });



            try {
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');

                const response = await pfFetch('/transcribe', { formData: formData },
                    { page: 'Flow', button: recordButtonS, label: 'Record' });

                const { transcript } = await response.json();

                fullTranscriptionSummary = transcript;

                const selectedSide = document.getElementById('selectedSide').textContent;
                processTranscriptionS(transcript, debateTopic, selectedSide);
                saveRound()

                // Handle UI elements
                const selectedTurn = document.getElementById('selectedTurn').textContent;
                if (selectedTurn === "Second") {
                    AIFFGenerateB.classList.add('glowing');
                } else if (selectedTurn === "First") {
                    toggleFlowButton.classList.add('glowing');
                    AISummaryGenerateB.classList.add('glowing');
                }


            } catch (error) {
                console.error('Transcription error:', error);
                document.querySelector('.loading2U').style.display = 'none';
                // Handle error state here
            }


            // Cleanup audio resources
            audioStream.getTracks().forEach(track => track.stop());
        };
    }
}


async function stopRecordingF() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        cancelAnimationFrame(animationFrame);

        mediaRecorder.onstop = async () => {
            document.querySelector('.listeningF').style.display = 'none';
            const durationSeconds = (Date.now() - recordingStartTime) / 1000;

            if (durationSeconds < 10) {
                // Hide loading and show error message

                transcriptionResultF.innerHTML = 'Please record a full public forum debate final focus';
                saveRound()
                // Cleanup audio resources
                audioStream.getTracks().forEach(track => track.stop());
                return; // Exit early without backend request
            }
            document.querySelector('.loading3U').style.display = 'block';

            // Create audio blob
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });


            try {
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');


                const response = await pfFetch('/transcribe', { formData: formData },
                    { page: 'Flow', button: recordButtonF, label: 'Record' });

                const { transcript } = await response.json();


                fullTranscriptionFF = transcript;
                const selectedSide = document.getElementById('selectedSide').textContent;
                processTranscriptionF(transcript, debateTopic, selectedSide);


                // Handle UI elements
                const selectedTurn = document.getElementById('selectedTurn').textContent;
                if (selectedTurn === "Second") {
                    saveRound()
                } else if (selectedTurn === "First") {
                    toggleFlowButton.classList.add('glowing');
                    AIFFGenerateB.classList.add('glowing');
                    saveRound()
                }


            } catch (error) {
                console.error('Transcription error:', error);
                document.querySelector('.loading3U').style.display = 'none';
                // Handle error state here
            }


            // Cleanup audio resources
            audioStream.getTracks().forEach(track => track.stop());
        };
    }
}




async function processTranscription(transcription, debateTopic, selectedSide) {
    document.querySelector('.loading0U').style.display = 'none';
    document.querySelector('.loadingU').style.display = 'block';
    // Send the transcription to your Python backend for processing
    try {
        const response = await pfFetch('/processC', {
            json: {
                transcription: transcription,
                debateTopic: debateTopic,
                selectedSide: selectedSide,
            }
        }, { page: 'Flow' });

        // Get the debate flow from the response
        const { CaseFlow } = await response.json(); // Parse JSON response
        // Update the display with the generated debate flow
        if (CaseFlow == '') {
            transcriptionResultC.innerHTML = 'Your speech does not resemble a public forum debate case.'
            saveRound()
        } else {
            transcriptionResultC.innerHTML = "<p>" + pfSanitize(CaseFlow) + "</p>";
            saveRound()
        }
    } catch (error) {
        console.error('Failed to process transcription:', error);
    } finally {
        document.querySelector('.loadingU').style.display = 'none';
    }
}

function processTranscriptionR(transcriptionR, debateTopic, selectedSide) {
    document.querySelector('.loading1U').style.display = 'none';
    document.querySelector('.loadingRU').style.display = 'block';
    // Send the transcription to your Python backend for processing
    pfFetch('/processR', {
        json: {
            transcriptionR: transcriptionR,
            debateTopic: debateTopic,
            selectedSide: selectedSide,
        }
    }, { page: 'Flow' })
        .then(response => response.json()) // Parse JSON response
        .then(data => {


            // Get the debate flow from the response
            const { RebuttalFlow } = data; // Parse JSON response
            // Update the display with the generated debate flow
            transcriptionResultR.innerHTML = "<p>" + pfSanitize(RebuttalFlow) + "</p>";
            saveRound()
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
    document.querySelector('.loading2U').style.display = 'none';
    document.querySelector('.loadingSU').style.display = 'block';
    // Send the transcription to your Python backend for processing
    pfFetch('/processS', {
        json: {
            transcriptionS: transcriptionS,
            debateTopic: debateTopic,
            selectedSide: selectedSide,
        }
    }, { page: 'Flow' })
        .then(response => response.json()) // Parse JSON response
        .then(data => {


            // Get the debate flow from the response
            const { SummaryFlow } = data; // Parse JSON response
            // Update the display with the generated debate flow


            transcriptionResultS.innerHTML = "<p>" + pfSanitize(SummaryFlow) + "</p>";
            saveRound()

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
    document.querySelector('.loading3U').style.display = 'none';
    document.querySelector('.loadingFFU').style.display = 'block';
    const selectedTurn = document.getElementById('selectedTurn').textContent;
    // Send the transcription to your Python backend for processing
    transcriptionResultF.textContent = '';
    pfFetch('/processF', {
        json: {
            transcriptionF: transcriptionF,
            debateTopic: debateTopic,
            selectedSide: selectedSide,
        }
    }, { page: 'Flow' })
        .then(response => response.json()) // Parse JSON response
        .then(data => {


            // Get the debate flow from the response
            const { FinalFocusFlow } = data; // Parse JSON response
            // Update the display with the generated debate flow


            transcriptionResultF.innerHTML = "<p>" + pfSanitize(FinalFocusFlow) + "</p>";
            saveRound()
        })
        .catch(error => {
            console.error('Failed to process transcription:', error);
        })
        .finally(() => {
            // Hide the loading animation
            document.querySelector('.loadingFFU').style.display = 'none';

            if (selectedTurn == 'Second') {
                updateResultsVisibility()
            }
            saveRound()
        });
}
function GenerateAIRebuttal(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, selectedSkill) {
    const selectedTurn = document.getElementById('selectedTurn').textContent;
    fullAIRebuttal = ''; // Reset full AI rebuttal
    GenerateAIRebuttalB.classList.remove('glowing');
    document.querySelector('.loadingRA').style.display = 'block';
    // Get the user's input from the text box
    // Send the user's input to the Python backend for processing
    if (selectedTurn == "First") {
        pfFetch('/secondrebuttal', {
            json: {
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                transcription: transcription,
                transcriptionR: transcriptionR,
                selectedSkill: selectedSkill
            }
        }, { page: 'Flow', button: GenerateAIRebuttalB, label: 'Generate' })
            .then(response => response.json()) // Parse JSON response
            .then(data => {


                // Get the AI response from the data
                const { AISecondRebuttal } = data;
                // Display the AI response
                document.getElementById('AIRebuttalText').innerHTML = "<p>" + pfSanitize(AISecondRebuttal) + "</p>";


            })
            .catch(error => {
                console.error('Error processing user input:', error);
            })
            .finally(() => {
                // Hide the loading animation
                document.querySelector('.loadingRA').style.display = 'none';
                GenerateAIRebuttalB.textContent = 'Generate';
                recordButtonS.classList.add('glowing');
                saveRound()

            });
    }
    if (selectedTurn == "Second") {
        pfFetch('/firstrebuttal', {
            json: {
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                transcription: transcription,
            }
        }, { page: 'Flow', button: GenerateAIRebuttalB, label: 'Generate' })
            .then(response => response.json()) // Parse JSON response
            .then(data => {


                // Get the AI response from the data
                const { AIFirstRebuttal } = data;
                // Display the AI response
                document.getElementById('AIRebuttalText').innerHTML = "<p>" + pfSanitize(AIFirstRebuttal) + "</p>";


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
                saveRound()

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
        pfFetch('/secondsummary', {
            json: {
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                transcription: transcription,
                transcriptionR: transcriptionR,
                transcriptionS: transcriptionS,
                AICase: AICase,
                AIRebuttal: AIRebuttal


            }
        }, { page: 'Flow', button: AISummaryGenerateB, label: 'Generate' })
            .then(response => response.json()) // Parse JSON response
            .then(data => {


                // Get the AI response from the data
                const { AISecondSummary } = data;
                // Display the AI response
                document.getElementById('AISummaryText').innerHTML = "<p>" + pfSanitize(AISecondSummary) + "</p>";


            })
            .catch(error => {
                console.error('Error processing user input:', error);
            })
            .finally(() => {
                // Hide the loading animation
                document.querySelector('.loadingSA').style.display = 'none';
                AISummaryGenerateB.textContent = 'Generate';
                recordButtonF.classList.add('glowing');
                saveRound()

            });
    }
    if (selectedTurn == "Second") {
        pfFetch('/firstsummary', {
            json: {
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                transcription: transcription,
                transcriptionR: transcriptionR,
                AICase: AICase,
                AIRebuttal: AIRebuttal


            }
        }, { page: 'Flow', button: AISummaryGenerateB, label: 'Generate' })
            .then(response => response.json()) // Parse JSON response
            .then(data => {


                // Get the AI response from the data
                const { AIFirstSummary } = data;
                // Display the AI response
                document.getElementById('AISummaryText').innerHTML = "<p>" + pfSanitize(AIFirstSummary) + "</p>";


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
                saveRound()

            });
    }


}
function GenerateAIFF(debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, transcriptionS, AICase, AIRebuttal, AISummary) {
    AIFFGenerateB.classList.remove('glowing');
    document.querySelector('.loadingFFA').style.display = 'block';
    pfFetch('/finalfocus', {
        json: {
            debateTopic: debateTopic,
            selectedSide: selectedSide,
            nonselectedSide: nonselectedSide,
            transcription: transcription,
            transcriptionR: transcriptionR,
            transcriptionS: transcriptionS,
            AICase: AICase,
            AIRebuttal: AIRebuttal,
            AISummary: AISummary
        }
    }, { page: 'Flow', button: AIFFGenerateB, label: 'Generate' })
        .then(response => response.json()) // Parse JSON response
        .then(data => {
            // Get the AI response from the data
            const { AIFinalFocus } = data;




            // Display the AI response
            document.getElementById('AIFFText').innerHTML = "<p>" + pfSanitize(AIFinalFocus) + "</p>";
        })
        .catch(error => {
            console.error('Error processing user input:', error);
        })
        .finally(() => {
            // Hide the loading animation
            document.querySelector('.loadingFFA').style.display = 'none';
            AIFFGenerateB.textContent = 'Generate';
            const selectedTurn = document.getElementById('selectedTurn').textContent;
            saveRound()
            if (selectedTurn == "Second") {
                toggleFlowButton.classList.add('glowing');
                recordButtonF.classList.add('glowing');
                saveRound()
            }
            else {
                updateResultsVisibility()
                saveRound()

            }
        });
}
function stopGeneratingAISummary() {


}
function stopGeneratingAIFF() {


}


async function startSpeakingS() {
    if (!isSpeakingS) {
        await speakFromElement('AISummaryText', () => isSpeakingS, playAudioQueueS);
    }
}
async function startSpeakingF() {
    if (!isSpeakingF) {
        await speakFromElement('AIFFText', () => isSpeakingF, playAudioQueueF);
    }
}

function captureState() {
    const state = {
        // Save text content from boxes
        AICase: document.getElementById('AIContentionText').innerHTML,
        AIRebuttal: document.getElementById('AIRebuttalText').innerHTML,
        AISummary: document.getElementById('AISummaryText').innerHTML,
        AIFF: document.getElementById('AIFFText').innerHTML,
        ContentionFlow: transcriptionResultC.innerHTML,
        RebuttalFlow: transcriptionResultR.innerHTML,
        SummaryFlow: transcriptionResultS.innerHTML,
        FFFlow: transcriptionResultF.innerHTML,
        transcriptionC: fullTranscriptionContention,
        transcriptionR: fullTranscriptionRebuttal,
        transcriptionS: fullTranscriptionSummary,
        transcriptionF: fullTranscriptionFF,
        feedback: document.getElementById('feedback-content').innerHTML,
        toggle: ToggleisSelectedSide,
        savedToProfile: __roundSavedToProfile
    };
    return state;
}
function saveRound() {
    if (!__savedRoundKey) return; // No signed-in user resolved yet
    const state = captureState();
    localStorage.setItem(__savedRoundKey, JSON.stringify(state));

}
function clearSavedRound() {
    if (__savedRoundKey) localStorage.removeItem(__savedRoundKey);
    localStorage.removeItem('savedRound'); // Old single-key format

    location.reload(); // Optional: Reload the page to reset the state
}

// Add to JavaScript
function openResultsModal() {
    document.getElementById('results-modal').style.display = 'block';
}

function closeResultsModal() {
    document.getElementById('results-modal').style.display = 'none';
}

function selectJudgeType(type) {
    if (['tech', 'lay'].includes(type)) {
        judgeType = type;

        document.querySelectorAll('.judge-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-type') === type);
        });
    }

}
function onResultsButtonShown(){
  if (__roundSavedToProfile) return;

  const user = (window.currentUser && window.currentUser()) || null;
  if (!user) return; // only save/award if logged in

  // Take a snapshot of the round at the moment Results become available
  const state = captureState(); // uses your existing function

  const round = {
    ...state,
    // Make sure we persist the topic + judge + quick meta for the profile card
    meta: {
      debateTopic: getDebateTopicSafe(),
      selectedSide: document.getElementById('selectedSide')?.textContent?.trim() || '',
      selectedTurn: document.getElementById('selectedTurn')?.textContent?.trim() || '',
      judgeType: (typeof judgeType !== 'undefined' ? judgeType : 'tech')
    },
    // Keep the feedback HTML if it already exists in the DOM
    Feedback: document.getElementById('feedback-content')?.innerHTML || '',
    timestamp: Date.now()
  };

  // Save & award
  const id = (window.addRoundForUser && addRoundForUser(user.uid, round)) || null;
  if (id) window.__currentRoundId = id;   // <-- add this line
  if (window.addGemsToUser) addGemsToUser(user.uid, 100);

  __roundSavedToProfile = true;

  // (Optional) tiny visual cue on the button
  try { document.getElementById('results-btn')?.setAttribute('data-saved', '1'); } catch {}
}
// NEW: update the saved profile round with feedback (no extra gems, no duplicates)
function saveFeedbackToProfile() {
  try {
    const user = (window.currentUser && window.currentUser()) || null;
    if (!user) return;

    const id = window.__currentRoundId || null;
    const feedbackHtml = document.getElementById('feedback-content')?.innerHTML || '';
    const judge = (typeof judgeType !== 'undefined' ? judgeType : 'tech');

    // What we want to update on the saved round
    const patch = {
      Feedback: feedbackHtml,
      // keep judge + topic + quick meta in sync
      meta: {
        debateTopic: getDebateTopicSafe(),
        selectedSide: document.getElementById('selectedSide')?.textContent?.trim() || '',
        selectedTurn: document.getElementById('selectedTurn')?.textContent?.trim() || '',
        judgeType: judge
      }
    };

    // If auth.js exposes an updater, use it.
    if (typeof window.updateRoundForUser === 'function' && id) {
      window.updateRoundForUser(user.uid, id, patch);
      return;
    }

    // Fallback: mutate localStorage directly (same schema as profile.html)
    const key = `pfai_profile::${user.uid}`;
    const profile = JSON.parse(localStorage.getItem(key) || '{"gems":0,"rounds":[]}');
    const rounds = profile.rounds || [];

    // Prefer updating by id; otherwise update the most recent round
    const idx = id ? rounds.findIndex(r => r.id === id) : -1;
    if (idx >= 0) {
      rounds[idx] = { ...rounds[idx], ...patch };
    } else if (rounds.length) {
      rounds[rounds.length - 1] = { ...rounds[rounds.length - 1], ...patch };
    }

    profile.rounds = rounds;
    localStorage.setItem(key, JSON.stringify(profile));
  } catch (e) {
    console.error('saveFeedbackToProfile failed:', e);
  }
}

function generateFeedback(judgeType, selectedTurn, debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, transcriptionS, transcriptionF, AICase, AIRebuttal, AISummary, AIFinalFocus) {
    document.getElementById('feedback-content').innerHTML = ''
    document.querySelector('.loadingfeed').style.display = 'block';
    if (judgeType == 'tech') {

        pfFetch('/tech', {
            json: {
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                selectedTurn: selectedTurn,
                transcription: transcription,
                transcriptionR: transcriptionR,
                transcriptionS: transcriptionS,
                transcriptionF: transcriptionF,
                AICase: AICase,
                AIRebuttal: AIRebuttal,
                AISummary: AISummary,
                AIFinalFocus: AIFinalFocus
            }
        }, { page: 'Flow', button: generateFeedbackButton })
            .then(response => response.json()) // Parse JSON response
            .then(data => {
                // Get the AI response from the data
                const { TechFeedback } = data;




                // Display the AI response

                document.getElementById('feedback-content').innerHTML = "<p>" +
                    pfSanitize(TechFeedback)
                        .replace('Decision:', '<br>Decision:') +  // Add line break before Decision
                    "</p>";
            })
            .catch(error => {
                console.error('Error processing user input:', error);
            })
            .finally(() => {

                saveRound()
                saveFeedbackToProfile();
                document.querySelector('.loadingfeed').style.display = 'none';
            }
            );
    } else if (judgeType == 'lay') {
        pfFetch('/lay', {
            json: {
                debateTopic: debateTopic,
                selectedSide: selectedSide,
                nonselectedSide: nonselectedSide,
                selectedTurn: selectedTurn,
                transcription: transcription,
                transcriptionR: transcriptionR,
                transcriptionS: transcriptionS,
                transcriptionF: transcriptionF,
                AICase: AICase,
                AIRebuttal: AIRebuttal,
                AISummary: AISummary,
                AIFinalFocus: AIFinalFocus
            }
        }, { page: 'Flow', button: generateFeedbackButton })
            .then(response => response.json()) // Parse JSON response
            .then(data => {
                // Get the AI response from the data
                const { LayFeedback } = data;




                // Display the AI response
                document.getElementById('feedback-content').innerHTML = "<p>" + pfSanitize(LayFeedback) + "</p>";
            })
            .catch(error => {
                console.error('Error processing user input:', error);
            })
            .finally(() => {

                saveRound()
                saveFeedbackToProfile();
                document.querySelector('.loadingfeed').style.display = 'none';
            }
            );
    }

}




generateFeedbackButton.addEventListener('click', async () => {
    if (window.pfGate && !(await pfGate.requireAuth({ page: 'Flow' }))) return;
    const selectedSide = document.getElementById('selectedSide').textContent;
    const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
    const transcription = fullTranscriptionContention;
    const transcriptionR = fullTranscriptionRebuttal;
    const transcriptionS = fullTranscriptionSummary;
    const transcriptionF = fullTranscriptionFF;
    const AICase = document.getElementById('AIContentionText').innerHTML
    const AIRebuttal = document.getElementById('AIRebuttalText').innerHTML
    const AISummary = document.getElementById('AISummaryText').innerHTML
    const AIFF = document.getElementById('AIFFText').innerHTML
    judgeType = judgeType;
    const selectedTurn = document.getElementById('selectedTurn').textContent;
    generateFeedback(judgeType, selectedTurn, debateTopic, selectedSide, nonselectedSide, transcription, transcriptionR, transcriptionS, transcriptionF, AICase, AIRebuttal, AISummary, AIFF);


});

function toggleResultsButton(show) {
  const resultsBtn = document.getElementById('results-btn');
  const placeholder = document.getElementById('results-placeholder');

  if (show) {
    placeholder.classList.add('hidden');
    setTimeout(() => {
      resultsBtn.classList.add('visible');
    }, 50);
    // NEW: one-time profile save + 100 gems when Results first appear
    if (!__roundSavedToProfile) onResultsButtonShown();
  } else {
    resultsBtn.classList.remove('visible');
    setTimeout(() => {
      placeholder.classList.remove('hidden');
    }, 50);
  }
}


function downloadRoundAsPDF() {
    // Implement PDF generation using jsPDF or similar
    console.log('Downloading round as PDF...');
    // Example: 
    // const doc = new jsPDF();
    // doc.text('Round Transcript', 10, 10);
    // doc.save('debate-round.pdf');
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('results-modal');
    if (event.target === modal) {
        closeResultsModal();
    }
}

function updateResultsVisibility() {
    toggleResultsButton(checkRoundCompletion());
}

function checkRoundCompletion() {
    if (fullTranscriptionContention == '' || fullTranscriptionRebuttal == '' || fullTranscriptionSummary == '' || fullTranscriptionFF == '' || document.getElementById('AIContentionText').innerHTML == '' || document.getElementById('AIRebuttalText').innerHTML == '' || document.getElementById('AISummaryText').innerHTML == '' || document.getElementById('AIFFText').innerHTML == '') {
        roundOver = false;
        return false;
    } else {
        roundOver = true;
        return true;
    }

}
