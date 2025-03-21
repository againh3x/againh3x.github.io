body {
    
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(180deg, #EBF9FF, #99c9f9); /* Adjusted to match the image gradient */
      background-repeat: no-repeat;
      background-size: cover;
    }
    
    
    
    h1 {
      color: #333;
    }
    
    
    button {
      padding: 10px 20px;
      /* Add padding to make the button larger */
      background-color: #007bff;
      /* Change the background color */
      color: #fff;
      /* Change the text color */
      border: none;
      /* Remove the border */
      border-radius: 5px;
      /* Add border radius for rounded corners */
      cursor: pointer;
      /* Change cursor to pointer on hover */
    }
    
    
    button:hover {
      background-color: #0056b3;
      /* Darker background color on hover */
    }
    
    
    .small-text {
      position: absolute;
      top: 30px;
      right: 100px;
      font-size: 12px;
      color: black;
    }
    
    
    .header {
      display: flex;
      align-items: center;
      
    }
    
    
    #toggle-flow {
      margin-left: 10px;
      /* Adjust the margin as needed */
    }
    
    
    #debateTopic {
      width: 500px;
      /* Set the width of the text box */
      height: 40px;
      /* Set the height of the text box */
      padding: 8px;
      /* Add padding inside the text box */
      font-size: 16px;
      /* Set the font size */
      border: 1px solid #ccc;
      /* Add a border */
      border-radius: 5px;
      /* Add border radius for rounded corners */
    }
    
    
    .case-box,
    .rebuttal-box,
    .summary-box,
    .ff-box {
      border: 2px solid #10014e;
      padding: 0px 10px 10px;
      width: 25%;
      height: calc(100vh - 90px);
      overflow: auto;
      box-sizing: border-box;
      float: left;
      margin-bottom: 0px;
      /* Float the boxes to arrange them side by side */
    }
    
    
    .case-box h2,
    .rebuttal-box h2,
    .summary-box h2,
    .ff-box h2 {
      margin-right: 20px;
      width: auto;
    }
    
    
    #caseHeader,
    #rebuttalHeaderUser,
    #rebuttalHeaderAI,
    #summaryHeaderUser,
    #summaryHeaderAI,
    #FFHeaderUser,
    #FFHeaderAI {
      display: flex;
      align-items: center;
      width: calc(100%);
      font-size: 14px;
    }
    
    
    #transcriptionContentionText,
    #AIContentionText {
      width: auto;
      margin-top: 10px;
      
      /* Add some top margin for spacing */
    }
    
    #AIRebuttalText {
      width: auto;
      margin-top: 10px;
      /* Add some top margin for spacing */
    }
    
    #UserFlow,
    #AIFlow {
      display: flex;
      /* Use flexbox to arrange the elements */
    }
    
    
    #caseHeader,
    #caseHeaderAI {
      display: flex;
      align-items: center;
      width: calc(75%);
      font-size: 14px;
    }
    
    
    #caseHeader button,
    #caseHeaderAI button,
    #rebuttalHeaderUser button,
    #rebuttalHeaderAI button,
    #summaryHeaderUser button,
    #summaryHeaderAI button,
    #FFHeaderUser button,
    #FFHeaderAI button {
      margin-left: -3px;
      /* Adjust margin between button and text */
    }
    
    
    #caseHeader h2,
    #caseHeaderAI h2 {
      margin-right: 20px;
      width: auto;
    }
    
    
    .spinner {
      border: 8px solid #f3f3f3;
      /* Light grey */
      border-top: 8px solid #007bff;
      /* Blue */
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 2s linear infinite;
      margin: 20px auto;
      /* Center the spinner horizontally */
    }
    
    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
    
      100% {
        transform: rotate(360deg);
      }
    }
    
    .loading-container {
      display: none;
      /* Hidden by default */
      text-align: center;
      /* Center the spinner container */
    }
  
  
  
  
  .loading {
    text-align: center;
    margin-top: 100px;
    display: none;
  }
  
  .text10 {
    font-size: 20px;
    margin-bottom: 0px;
    
  }
  
  .ai-loader {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 10vh; /* Ensure it's centered in full view */
  }
  
  .dot {
    width: 15px;
    height: 15px;
    margin: 0 5px;
    border-radius: 50%;
    background-color: #2e5adc;
    animation: pulse 1.5s infinite;
  }
  
  .dot1 {
    animation-delay: 0s;
  }
  .dot2 {
    animation-delay: 0.2s;
  }
  .dot3 {
    animation-delay: 0.4s;
  }
  .dot4 {
    animation-delay: 0.6s;
  }
  .dot5 {
    animation-delay: 0.8s;
  }
  .dot6 {
    animation-delay: 1s;
  }
  
  @keyframes pulse {
    0%, 100% {
        opacity: 0.3;
        transform: scale(1);
    }
    50% {
        opacity: 1;
        transform: scale(1.2);
    }
  }
  
  .listeningC {
    text-align: center;
    display: none;
  }
  .listeningR {
    text-align: center;
    display: none;
  }
  
  .text100 {
    font-size: 20px;
    margin-bottom: 10px;
    
  }
  .listening-container {
    display: flex;
    align-items: center;
    text-align: center;
    justify-content: center;
    height: 40px; /* Adjust as needed */
  }
  
  .listening-container .stroke{
    display: block;
    position: relative;
    background: #2505c4;
    height: 100%;
    width: 10px;
    border-radius: 50px;
    margin: 0 5px;
    animation: animate 1.2s linear infinite
  }
  @keyframes animate {
    50% {
       height: 20%;
    }
    100% {
       height: 100%;
    }
  }
  
  .stroke:nth-child(1) {
    animation-delay: 0s;
  }
  .stroke:nth-child(2) {
    animation-delay: 0.3s;
  }
  .stroke:nth-child(3) {
    animation-delay: 0.6s;
  }
  .stroke:nth-child(4) {
    animation-delay: 0.9s;
  }
  .stroke:nth-child(5) {
    animation-delay: 0.6s;
  }
  .stroke:nth-child(6) {
    animation-delay: 0.3s;
  }
  .stroke:nth-child(7) {
    animation-delay: 0s;
  }
  
  .loadingU {
    text-align: center;
    margin-top: 100px;
    display: none;
  }
  .loading0U {
    text-align: center;
    margin-top: 100px;
    display: none;
  }
  .loading1U {
    text-align: center;
    margin-top: 100px;
    display: none;
  }
  .loading2U {
    text-align: center;
    margin-top: 100px;
    display: none;
  }
  .loading3U {
    text-align: center;
    margin-top: 100px;
    display: none;
  }
  .loadingRA {
    text-align: center;
    margin-top: 100px;
    display: none;
  }
  .loadingRU {
    text-align: center;
    margin-top: 100px;
    display: none;
  }
  .loadingSU {
    text-align: center;
    margin-top: 100px;
    display: none;
  }
  .loadingFFU {
    text-align: center;
    margin-top: 100px;
    display: none;
  }
  
  .loadingSA {
    text-align: center;
    margin-top: 100px;
    display: none;
  }
  .loadingFFA {
    text-align: center;
    margin-top: 100px;
    display: none;
  }
  
  
  .text10 {
    font-size: 20px;
    margin-bottom: 0px;
    
  }
  
  .ai-loader {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 10vh; /* Ensure it's centered in full view */
  }
  
  .dot {
    width: 15px;
    margin: 0 5px;
    border-radius: 50%;
    background-color: #2e5adc;
    animation: pulse 1.5s infinite;
  }
  
  .dot1 {
    animation-delay: 0s;
  }
  .dot2 {
    animation-delay: 0.2s;
  }
  .dot3 {
    animation-delay: 0.4s;
  }
  .dot4 {
    animation-delay: 0.6s;
  }
  .dot5 {
    animation-delay: 0.8s;
  }
  .dot6 {
    animation-delay: 1s;
  }
  
  @keyframes pulse {
    0%, 100% {
        opacity: 0.3;
        transform: scale(1);
    }
    50% {
        opacity: 1;
        transform: scale(1.2);
    }
  }
  
  
  button {
    font-family: sans-serif;
    font-size: 5px;
    padding: 0px 0px;
    margin: 10px;
    color: #ffffff;
    background: linear-gradient(45deg, #007BFF, #1E90FF);
    border: none;
    border-radius: 25px;
    cursor: pointer;
    box-shadow: 0px 4px 10px rgba(30, 144, 255, 0.5);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  
  button:before {
    content: "";
    position: absolute;
    top: 0;
    left: -50%;
    width: 200%;
    height: 100%;
    background: linear-gradient(45deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0));
    transform: skewX(-45deg);
    transition: left 0.4s ease;
  }
  
  button:hover:before {
    left: 150%;
  }
  
  button:hover {
    transform: scale(1.05);
    box-shadow: 0px 6px 15px rgba(30, 144, 255, 0.7);
  }
  
  button:active {
    transform: scale(1);
    box-shadow: 0px 2px 8px rgba(30, 144, 255, 0.7);
  }
  
  /* Specific buttons with extra effects */
  #toggle-flow, #GenerateAIContention, #SpeakAIContention, 
  #recordButtonRebuttal, #GenerateAISummary, #SpeakAISummary, 
  #recordButtonFF, #recordButtonContention, #GenerateAIRebuttal, 
  #speakAIRebuttal, #recordButtonSummary, #GenerateAIFF, #SpeakAIFF {
    flex-shrink: 0; /* Prevent shrinking */
    font-size: 14px;
    letter-spacing: 1px;
    text-align:center;
    width: 95px; /* Set your desired width */
    height: 45px; /* Set your desired height */
    font-weight: bold;
  }
  /* Specific buttons with extra effects */
   #SpeakAIContention, 
   #SpeakAISummary, 
  #speakAIRebuttal, #SpeakAIFF {
    flex-shrink: 0; /* Prevent shrinking */
    font-size: 14px;
    letter-spacing: 1px;
    text-align:center;
    width: 80px; /* Set your desired width */
    height: 45px; /* Set your desired height */
    font-weight: bold;
  }
  #toggle-flow {
    width: 150px; /* Set your desired width */
  
  }
  .glowing {
    box-shadow: 0 0 20px 4px rgba(162, 80, 255, 0.8)  /* Green glow */ !important;
    transition: box-shadow 0.3s ease-in-out;
  }

  @keyframes shine {
    0% { transform: translateX(-100%) rotate(45deg); }
    100% { transform: translateX(100%) rotate(45deg); }
}

@keyframes border-glow {
    0%, 100% { border-color: rgba(0, 168, 255, 0.3); }
    50% { border-color: rgba(0, 168, 255, 0.7); }
}



.dot {
    background-color: #00a8ff;
    box-shadow: 0 0 10px rgba(0, 168, 255, 0.4);
}


body {
    
    background: linear-gradient(180deg, #0a192f, #0a1a2f, #020d1a);
    color: #b1e0f9;
    margin: 0;
    padding: 20px;
    min-height: 100vh;
}

/* Header Styling */
h1 {
    color: #7dd3fc;
    text-shadow: 0 0 15px rgba(125, 211, 252, 0.3);
    font-size: 2rem;
    margin: 20px 0;
}

/* Buttons - Match Home Page Style */


/* Input Fields */
#debateTopic {
    background: rgba(15, 32, 55, 0.9);
    border: 2px solid #7dd3fc;
    color: #aae1ff;
    border-radius: 8px;
    padding: 12px;
    font-size: 1rem;
}

/* Case Boxes */
.case-box,
.rebuttal-box,
.summary-box,
.ff-box {
    background: rgba(15, 32, 55, 0.9);
    border: 2px solid #7dd3fc;
    border-radius: 12px;
    box-shadow: 0 0 20px rgba(125, 211, 252, 0.1);
    padding: 15px;
    
    margin: 5px;
    color: #a3ddfc;
}

/* Loading Animations */
.dot {
    background-color: #7dd3fc;
    box-shadow: 0 0 10px rgba(125, 211, 252, 0.4);
}

/* Toolbar/Header */
.header {
    background: rgba(10, 35, 66, 0.9);
    padding-left: 15px;
    padding-top: 5px;
    padding-bottom: 5px;
    border-radius: 8px;
    margin-bottom: 10px;
    
    border: 1px solid #7dd3fc;
}

/* Text Elements */
.text10, .text100 {
    color: #95cfff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* Special Effects */


@keyframes pulse {
    0%, 100% {
        opacity: 0.3;
        transform: scale(1);
    }
    50% {
        opacity: 1;
        transform: scale(1.1);
        box-shadow: 0 0 15px rgba(125, 211, 252, 0.6);
    }
}

/* Preserve existing layout properties below this line */
.case-box,
.rebuttal-box,
.summary-box,
.ff-box {
    width: calc(25vw - 15px);
    height: calc(100vh - 120px);
    overflow: auto;
    box-sizing: border-box;
    float: left;
    margin-bottom: 0px;
}

#debateTopic {
    width: 500px;
    height: 40px;
}

/* Keep all existing media queries and layout-specific rules */
@media (max-width: 768px) {
    /* Preserve responsive styles */
}

body {
    
    padding: 10px 10px 0; /* Adjust bottom padding */
    overflow: 'hidden';
}
.save-load-buttons {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    gap: 10px;
}

.save-load-buttons button {
    background: linear-gradient(45deg, #007BFF, #1E90FF);
    border: none;
    border-radius: 25px;
    color: #ffffff;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0px 4px 10px rgba(30, 144, 255, 0.5);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.save-load-buttons button:hover {
    transform: scale(1.05);
    box-shadow: 0px 6px 15px rgba(30, 144, 255, 0.7);
}

.save-load-buttons button:active {
    transform: scale(1);
    box-shadow: 0px 2px 8px rgba(30, 144, 255, 0.7);
}
.save-button {
    position: absolute;
    top: 20px;
    right: 20px;
}

.save-button button {
    background: linear-gradient(45deg, #007BFF, #1E90FF);
    border: none;
    border-radius: 25px;
    color: #ffffff;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0px 4px 10px rgba(30, 144, 255, 0.5);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.save-button button:hover {
    transform: scale(1.05);
    box-shadow: 0px 6px 15px rgba(30, 144, 255, 0.7);
}

.save-button button:active {
    transform: scale(1);
    box-shadow: 0px 2px 8px rgba(30, 144, 255, 0.7);
}
.save-button {
    display: flex;
    gap: 10px; /* Add spacing between buttons */
}
.save-button {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    gap: 12px;
    z-index: 100;
}

.save-button button {
    border: none;
    border-radius: 12px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 0px;
}

/* Save Button */
.save-button button:first-child {
    background: linear-gradient(145deg, #00c853, #009624);
    color: #fff;
    box-shadow: 0 4px 15px rgba(0, 200, 83, 0.3);
}

/* Clear Button */
.save-button button:last-child {
    background: linear-gradient(145deg, #ff1744, #d50000);
    color: #fff;
    box-shadow: 0 4px 15px rgba(255, 23, 68, 0.3);
}

.save-button button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 200, 83, 0.4), 0 4px 6px rgba(0, 0, 0, 0.1);
}

.save-button button:last-child:hover {
    box-shadow: 0 6px 20px rgba(255, 23, 68, 0.4), 0 4px 6px rgba(0, 0, 0, 0.1);
}

.save-button button:active {
    transform: translateY(0);
    filter: brightness(0.9);
}

/* Small Text Styling */
.small-text {
    position: absolute;
    top: 70px; /* Moved below buttons */
    right: 20px;
    font-size: 13px;
    color: #b1e0f9;
    background: rgba(15, 32, 55, 0.9);
    padding: 5px 10px;
    border-radius: 6px;
    border: 1px solid #7dd3fc33;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(4px);
    display: flex;
    gap: 8px;
    z-index: 99;
}

.small-text span {
    color: #7dd3fc;
    font-weight: 600;
}
.save-button {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    gap: 12px;
    z-index: 100;
}

.save-button button {
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.5px;
    position: relative;
    overflow: hidden;
}

/* Save Button - Cyber Blue */
.save-button button:first-child {
    background: linear-gradient(145deg, #2563eb, #1d4ed8);
    color: #bfdbfe;
    border: 1px solid #3b82f677;
}

/* Clear Button - Cosmic Purple */
.save-button button:last-child {
    background: linear-gradient(145deg, #6d28d9, #4c1d95);
    color: #e9d5ff;
    border: 1px solid #7c3aed77;
}

/* Hover Effects */
.save-button button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
    filter: brightness(1.1);
}

.save-button button:last-child:hover {
    box-shadow: 0 4px 20px rgba(109, 40, 217, 0.3);
}

/* Active State */
.save-button button:active {
    transform: translateY(0);
    filter: brightness(0.95);
}

/* Glow Animation */
@keyframes button-glow {
    0% { box-shadow: 0 0 10px rgba(59, 130, 246, 0.3); }
    50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.5); }
    100% { box-shadow: 0 0 10px rgba(59, 130, 246, 0.3); }
}

.save-button button::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 200%;
    height: 100%;
    background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.15),
        transparent
    );
    transition: left 0.6s ease;
}
.save-button {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    gap: 12px;
    z-index: 100;
}

.save-button button {
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.5px;
    position: relative;
    overflow: hidden;
}

/* Save Button - Cyber Teal */
.save-button button:first-child {
    background: linear-gradient(145deg, #0decca, #08b4a0);
    color: #042f2e;
    border: 1px solid #2dd4bf55;
}

/* Clear Button - Deep Space Purple */
.save-button button:last-child {
    background: linear-gradient(145deg, #6d28d9, #4c1d95);
    color: #e9d5ff;
    border: 1px solid #7c3aed55;
}

/* Other Action Buttons */
#toggle-flow, #GenerateAIContention, #SpeakAIContention, 
#recordButtonRebuttal, #GenerateAISummary, #SpeakAISummary, 
#recordButtonFF, #recordButtonContention, #GenerateAIRebuttal, 
#speakAIRebuttal, #recordButtonSummary, #GenerateAIFF, #SpeakAIFF {
    
    color: #bfdbfe;
    border: 1px solid #3b82f655;
}

/* Hover Effects */
.save-button button:hover {
    transform: translateY(-2px);
    filter: brightness(1.05);
    box-shadow: 0 4px 20px rgba(13, 236, 202, 0.3);
}

.save-button button:last-child:hover {
    box-shadow: 0 4px 20px rgba(109, 40, 217, 0.3);
}

/* Active States */
.save-button button:active {
    transform: translateY(0);
    filter: brightness(0.95);
}

/* Shine Animation */
.save-button button::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
        45deg,
        transparent,
        rgba(255, 255, 255, 0.1),
        transparent
    );
    transform: rotate(45deg);
    
}

@keyframes button-shine {
    0% { left: -50%; }
    100% { left: 150%; }
}

.save-button {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    gap: 12px;
    z-index: 100;
}

.save-button button {
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: 0.5px;
    position: relative;
    overflow: hidden;
}

/* Save Button - Active Animation */
.save-button button:first-child {
    background: linear-gradient(145deg, #dc4b76, #b40816);
    color: #93b0b0;
    border: 1px solid #2dd4bf55;
    
}

@keyframes save-pulse {
    0%, 100% { box-shadow: 0 0 10px rgba(13, 236, 202, 0.3); }
    50% { box-shadow: 0 0 20px rgba(13, 236, 202, 0.5); }
}

/* Enhanced Click Effect for Save */
.save-button button:first-child:active {
    transform: scale(0.95);
    filter: brightness(0.9);
    box-shadow: 0 0 15px rgba(13, 236, 202, 0.6) !important;
}

/* Clear Button - Static Style */


/* Clear Button Interactions */
.save-button button:last-child:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 12px rgba(109, 40, 217, 0.2);
}

.save-button button:last-child:active {
    transform: scale(0.98);
    filter: brightness(0.95);
}

/* Save Button Shine Animation */
.save-button button:first-child::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
        45deg,
        transparent,
        rgba(255, 255, 255, 0.3),
        transparent
    );
    transform: rotate(45deg);
    
}

@keyframes button-shine {
    0% { left: -50%; }
    100% { left: 150%; }
}
.save-note {
    position: relative;
    top: 2px;
    right: 10px;
    color: #7dd3fc;
    font-size: 0.8em;
    opacity: 0.8;
    font-style: italic;
    white-space: nowrap;
    padding-right: 15px;
    border-right: 1px solid #7dd3fc33;
    height: 32px;
    display: flex;
    align-items: center;
    backdrop-filter: blur(2px);
}
