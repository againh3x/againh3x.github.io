var toggleFlowButton = document.getElementById('toggle-flow');
var recordButtonC = document.getElementById('recordButtonContention');
var speakButtonAI = document.getElementById('SpeakAIContention');
var transcriptionResultC = document.getElementById('transcriptionContentionText');
var UserFlowDiv = document.getElementById('UserFlow');
var AIFlowDiv = document.getElementById('AIFlow');
var AIRebuttalButton = document.getElementById('speakAIRebuttal');
var recordButtonR = document.getElementById('recordButtonRebuttal');

var ToggleisSelectedSide;
var recognition;
var isRecordingC = false;
var isRecordingR = false;
var fullTranscriptionContention = '';
var fullAIContentionRaw = '';
var fullAIRebuttal = '';
var fullTranscriptionRebuttal = '';
var isSpeaking = false;
var isRebutting = false;

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
        
    } else {
        
        ToggleisSelectedSide = true;
        toggleFlowButton.textContent = 'Toggle ' + nonselectedSide;
    }

    updateFlowValues(selectedSide, nonselectedSide);
    
 
});


speakButtonAI.addEventListener('click', () => {
    if (!isSpeaking) {
        const selectedSide = document.getElementById('selectedSide').textContent;
        const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';
        startSpeaking(debateTopic, nonselectedSide);
        speakButtonAI.textContent = 'Stop'; // Change button text to "Stop"
        isSpeaking = true; 
    } else {
        stopSpeaking();
        speakButtonAI.textContent = 'Speak'; // Change button text back to "Speak"
        isSpeaking = false;
    }
});

AIRebuttalButton.addEventListener('click', () => {
    if (!isRebutting) {
        startAIRebuttal();
        AIRebuttalButton.textContent = 'Stop'; // Change button text to "Stop"
        isRebutting = true; 
    } else {
        stopAIRebuttal();
        AIRebuttalButton.textContent = 'Speak'; // Change button text back to "Speak"
        isRebutting = false;
    }
});

function stopSpeaking() {
    if (isSpeaking){
    speechSynthesis.cancel();
    isSpeaking = false;
    }

}

function stopAIRebuttal() {
    if (isRebutting){
    speechSynthesis.cancel();
    isRebutting = false;
    }

}


function startSpeaking(debateTopic, nonselectedSide) {
fullAIContentionRaw = ''; // Reset full AI response

// Get the user's input from the text box


// Send the user's input to the Python backend for processing
fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/', {
    method: 'POST', // Specify POST method
    body: JSON.stringify({ 
        debateTopic: debateTopic,
        nonselectedSide: nonselectedSide
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
    const { AIContention } = data;

    var msg = new SpeechSynthesisUtterance();
    msg.text = AIContention;
    window.speechSynthesis.speak(msg);
    
    // Display the AI response
    document.getElementById('AIContentionText').innerHTML = "<p>" + AIContention.replace(/\n/g, '<br>') + "</p>";
})
.catch(error => {
    console.error('Error processing user input:', error);
});
}


function startAIRebuttal() {
    fullAIRebuttal = ''; // Reset full AI rebuttal
    
    // Get the user's input from the text box
    // Send the user's input to the Python backend for processing
    fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/', {
        method: 'POST', // Specify POST method
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
        const { AIRebuttal } = data;
    
        var msg = new SpeechSynthesisUtterance();
        msg.text = AIRebuttal;
        window.speechSynthesis.speak(msg);
        
        // Display the AI response
        document.getElementById('AIRebuttalText').innerHTML = "<p>" + AIContention.replace(/\n/g, '<br>') + "</p>";
    })
    .catch(error => {
        console.error('Error processing user input:', error);
    });
    }
    
toggleFlowButton.addEventListener('click', () => {
    const selectedSide = document.getElementById('selectedSide').textContent;
    const nonselectedSide = (selectedSide === 'Aff') ? 'Neg' : 'Aff';

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
    }
});


function startRecording() {
    fullTranscriptionContention = ''; // Reset full transcription
    // Initialize speech recognition
    recognition = new webkitSpeechRecognition();
    recognition.lang = window.navigator.language;
    
    recognition.continuous = true; // Continuous listening
    recognition.interimResults = true; // Get interim results
    recognition.start(); // Start recognition

    // Event listener for speech recognition results
    recognition.addEventListener('result', async (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) { // Only handle final results
                const transcript = result[0].transcript;
                fullTranscriptionContention += transcript + ' '; // Append with space separator
                transcriptionResultC.textContent = fullTranscriptionContention; // Update display
                
            }
        }
    });
}

function stopRecording() {
    if (recognition) {
        recognition.stop(); // Stop speech recognition
        const selectedSide = document.getElementById('selectedSide').textContent;
                // Process the transcription to generate debate flow
        processTranscription(fullTranscriptionContention, debateTopic, selectedSide);
    }
}

async function processTranscription(transcription, debateTopic, selectedSide) {
    // Send the transcription to your Python backend for processing
    const response = await fetch('https://pf-ai-debater-24c5902c1a88.herokuapp.com/', {
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
        const { debateFlow } = await response.json(); // Parse JSON response
        // Update the display with the generated debate flow
       
        transcriptionResultC.innerHTML = "<p>" + debateFlow.replace(/\n/g, '<br>') + "</p>";
    } else {
        console.error('Failed to process transcription:', response.statusText);
    }
}


