const audioFileInput = document.getElementById('audioFile');
const canvas = document.getElementById('visualizer');
const canvasContext = canvas.getContext('2d');
const playButton = document.getElementById('playButton');
const stopButton = document.getElementById('stopButton');
const nextButton = document.getElementById('nextButton');
const rewindButton = document.getElementById('rewindButton');
const volumeControl = document.getElementById('volumeControl');
const progressControl = document.getElementById('progressControl');
progressControl.style.display = 'none'; // 初期状態では非表示
const uploadProgressContainer = document.querySelector('.upload-progress-container');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const uploadStatus = document.getElementById('uploadStatus');

let audioContext;
let analyser;
let dataArray;
let bufferLength;
let audioBufferList = [];
let currentTrackIndex = 0;
let source;
let totalFilesToUpload = 0;
let filesUploadedCount = 0;
let isDraggingProgress = false;
let progressBarHandleRadius = 8; // 白い丸の半径
let currentProgressPercentage = 0; // 0 to 100
const h1Element = document.querySelector('h1');

// ファイルが選択されたときの処理
audioFileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    const thumbnail = document.getElementById('thumbnail');

    if (files.length === 0) {
        thumbnail.textContent = '';
        thumbnail.style.display = 'none';
        uploadProgressContainer.style.display = 'none';
        return;
    }

    // Display total number of files selected for now, or first file name
    if (files.length > 1) {
        thumbnail.textContent = `SELECTED FILES: ${files.length} items`;
    } else {
        thumbnail.textContent = `SELECTED FILE: ${files[0].name}`;
    }
    thumbnail.style.display = 'block';
    uploadProgressContainer.style.display = 'block';
    uploadProgressBar.value = 0;
    uploadStatus.textContent = 'Preparing to upload...'; // Initial message

    // Reset audio state
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().then(() => {
            audioContext = null;
            source = null;
            audioBufferList = [];
            currentTrackIndex = 0;
            playButton.style.display = 'inline-block';
            stopButton.style.display = 'none';
            if (progressControl) progressControl.value = 0;
            // currentProgressPercentage = 0; // Will be replaced by progressControl.value
            loadFiles(files);
        });
    } else {
        audioBufferList = []; // Clear previous list
        currentTrackIndex = 0;
        loadFiles(files);
    }
});

function loadFiles(files) {
    totalFilesToUpload = files.length;
    filesUploadedCount = 0;
    audioBufferList = []; // Reset buffer list for new uploads
    let allFilesProcessed = 0;

    if (totalFilesToUpload === 0) {
        uploadProgressContainer.style.display = 'none';
        return;
    }

    uploadProgressBar.value = 0;
    uploadStatus.textContent = `Uploading 0/${totalFilesToUpload}... 0%`;


    Array.from(files).forEach((file, index) => {
        const fileReader = new FileReader();

        // For simplicity, progress bar will show the progress of the first file
        // or an aggregate if we implement more complex progress tracking.
        // Here, we'll just update for the first file for now.
        if (index === 0) {
            fileReader.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentLoaded = Math.round((e.loaded / e.total) * 100);
                    uploadProgressBar.value = percentLoaded;
                    // Update status to reflect current file being uploaded if desired
                    uploadStatus.textContent = `Uploading ${filesUploadedCount + 1}/${totalFilesToUpload}: ${file.name}... ${percentLoaded}%`;
                }
            };
        }

        fileReader.onload = (e) => {
            const arrayBuffer = e.target.result;
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
                audioBufferList.push(audioBuffer); // Add to list
                filesUploadedCount++;
                allFilesProcessed++;

                uploadStatus.textContent = `FILE UPLOADED! (${filesUploadedCount}/${totalFilesToUpload})`;
                uploadProgressBar.value = (filesUploadedCount / totalFilesToUpload) * 100;


                if (filesUploadedCount === totalFilesToUpload) {
                    uploadStatus.textContent = `ALL FILES UPLOADED! (${filesUploadedCount}/${totalFilesToUpload})`;
                    setTimeout(() => {
                        uploadStatus.textContent = '';
                        uploadProgressContainer.style.display = 'none'; // Hide progress bar after all uploads
                    }, 3000);
                    // Optionally, auto-play the first track or wait for play button
                    // initAudio(audioBufferList[0]); // Uncomment to auto-play
                } else {
                     // Keep showing progress for the next file if any, or overall progress
                    uploadStatus.textContent = `FILE UPLOADED! (${filesUploadedCount}/${totalFilesToUpload}). Next...`;
                }
            }, (error) => {
                allFilesProcessed++;
                console.error(`Error decoding audio data for ${file.name}:`, error);
                uploadStatus.textContent = `Error decoding ${file.name}. (${filesUploadedCount}/${totalFilesToUpload})`;
                if (allFilesProcessed === totalFilesToUpload) {
                     // Handle case where some files failed
                    setTimeout(() => {
                        uploadStatus.textContent = '';
                        // Decide if progress bar should hide if there were errors
                        // uploadProgressContainer.style.display = 'none';
                    }, 3000);
                }
            });
        };

        fileReader.onerror = () => {
            allFilesProcessed++;
            console.error(`FileReader error for ${file.name}`);
            uploadStatus.textContent = `Error reading ${file.name}. (${filesUploadedCount}/${totalFilesToUpload})`;
            if (allFilesProcessed === totalFilesToUpload) {
                setTimeout(() => {
                    uploadStatus.textContent = '';
                    // uploadProgressContainer.style.display = 'none';
                }, 3000);
            }
        };
        fileReader.readAsArrayBuffer(file);
    });
}


playButton.addEventListener('click', () => {
    if (!audioContext) { // Initialize AudioContext if it doesn't exist
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioBufferList.length === 0) {
        // alert("Please select an audio file first.");
        return;
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            if (source) { // If source exists, it means it was paused
                playButton.style.display = 'none';
                stopButton.style.display = 'inline-block';
            } else { // If no source, it means we need to start from beginning or specified time
                const startTime = (audioBufferList[currentTrackIndex] && progressControl.value) ? parseFloat(progressControl.value) : 0;
                initAudio(audioBufferList[currentTrackIndex], startTime);
            }
        });
    } else if (audioContext.state === 'closed') { // If context was closed (e.g., after new file load)
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        initAudio(audioBufferList[currentTrackIndex]);
        progressControl.style.display = 'block'; // 再生時に表示
    }
    else if (!source || (source && source.playbackState !== AudioBufferSourceNode.PLAYING_STATE && source.playbackState !== AudioBufferSourceNode.FINISHED_STATE) ) {
        // If no source, or source is not playing and not finished (i.e. stopped or new)
        const startTime = (audioBufferList[currentTrackIndex] && progressControl.value) ? parseFloat(progressControl.value) : 0;
        initAudio(audioBufferList[currentTrackIndex], startTime);
        progressControl.style.display = 'block'; // 再生時に表示
    }
});

stopButton.addEventListener('click', () => {
    if (audioContext && audioContext.state === 'running' && source) {
        audioContext.suspend().then(() => {
            playButton.style.display = 'inline-block';
            stopButton.style.display = 'none';
        });
    }
});

rewindButton.addEventListener('click', () => {
    if (audioBufferList.length > 0 && audioContext) {
        // Restart current track from beginning
        initAudio(audioBufferList[currentTrackIndex], 0);
        if (progressControl) progressControl.value = 0;
    }
});

nextButton.addEventListener('click', () => {
    if (audioBufferList.length > 0 && audioContext) {
        currentTrackIndex = (currentTrackIndex + 1) % audioBufferList.length;
        initAudio(audioBufferList[currentTrackIndex], 0); // Start next track from beginning
        if (progressControl) progressControl.value = 0;
    }
});

volumeControl.addEventListener('input', (event) => {
    const volume = event.target.value;
    if (source) {
        const gainNode = audioContext.createGain();
        gainNode.gain.value = volume;
        source.disconnect();
        source.connect(gainNode).connect(analyser).connect(audioContext.destination);
    }
});

if (progressControl) {
    progressControl.addEventListener('input', (event) => {
        if (audioBufferList.length > 0 && audioBufferList[currentTrackIndex] && audioContext) {
            const newTime = parseFloat(event.target.value);
            // If audio is currently playing, stop it before seeking
            if (source && audioContext.state === 'running') {
                try {
                    source.onended = null; // Prevent onended event from firing during seek
                    source.stop();
                } catch (e) {
                    console.warn("Error stopping source for seek:", e.message);
                }
            }
            // Re-initialize audio at the new time
            initAudio(audioBufferList[currentTrackIndex], newTime);
        }
    });
}

// Canvas interaction for progress bar
// canvas要素上のプログレスバー関連のイベントリスナーは削除またはコメントアウト
// canvas.addEventListener('mousedown', (event) => { ... });
// canvas.addEventListener('mousemove', (event) => { ... });
// canvas.addEventListener('mouseup', () => { ... });
// canvas.addEventListener('mouseleave', () => { ... });

// function updateProgressFromMouse(mouseX) { ... }

function initAudio(audioBuffer, startTime = 0) {
    if (!audioBuffer) {
        console.warn("initAudio called with no audioBuffer");
        return;
    }
    if (progressControl && audioBuffer && audioBuffer.duration > 0) {
        progressControl.max = audioBuffer.duration; // 曲の長さを設定
        progressControl.value = startTime; // 開始位置を設定
        progressControl.style.display = 'block'; // 表示する
    } else if (progressControl) {
        progressControl.max = 100; // Default if no duration
        progressControl.value = 0;
        progressControl.style.display = 'none'; // 表示しない
    }

    if (!audioContext || audioContext.state === 'closed') {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (source) {
        try {
            source.onended = null;
            source.stop();
        } catch (e) {
            // Ignore errors if source is already stopped or not in a valid state to stop
            console.warn("Error stopping previous source:", e.message);
        }
    }

    source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; // Adjusted for better visual response
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    const gainNode = audioContext.createGain();
    gainNode.gain.value = volumeControl.value;

    source.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioContext.destination);

    // Ensure context is running before starting source
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            source.start(0, startTime);
            playButton.style.display = 'none';
            stopButton.style.display = 'inline-block';
            progressControl.style.display = 'block'; // 表示
        });
    } else {
        source.start(0, startTime);
        playButton.style.display = 'none';
        stopButton.style.display = 'inline-block';
        progressControl.style.display = 'block'; // 表示
    }

    trackSourceStartTime(source, startTime); // Call helper

    source.onended = () => {
        if (audioContext.state !== 'suspended' && stopButton.style.display !== 'none') {
            if (source && source.buffer && progressControl.value >= progressControl.max - 0.1) { // progressControlの値で終了を判断
                playButton.style.display = 'inline-block';
                stopButton.style.display = 'none';
                progressControl.value = 0; // プログレスバーをリセット
                if (currentTrackIndex < audioBufferList.length - 1) {
                    // Optionally auto-play next:
                    // currentTrackIndex++;
                    // initAudio(audioBufferList[currentTrackIndex]);
                } else {
                    currentTrackIndex = 0; // Loop to the first track
                    // progressControl.style.display = 'none'; // 全トラック終了で非表示にする場合
                }
            }
        }
    };

    if (!animationFrameId) {
        visualize();
    }
}

let animationFrameId = null;

function trackSourceStartTime(sourceNode, offset) {
    if(sourceNode && audioContext) {
        sourceNode.startTimeWhenStarted = audioContext.currentTime - offset; // startTimeを考慮
        sourceNode.startOffsetWhenStarted = offset; // offsetは記録しておく
    }
}


function visualize() {
    const barWidth = bufferLength > 0 ? (canvas.width / bufferLength) * 1.2 : 0;
    let x = 0;

    function draw() {
        animationFrameId = requestAnimationFrame(draw);

        canvasContext.fillStyle = '#0f0f0f';
        canvasContext.fillRect(0, 0, canvas.width, canvas.height);

        if (!analyser || !dataArray) {
            // アナライザーが準備できていない場合は描画をスキップするか、プレースホルダーを描画
            return;
        }

        analyser.getByteFrequencyData(dataArray);
        x = 0;

        if (bufferLength > 0) {
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] * (canvas.height / 255);
                const hue = 180 + (dataArray[i] / 255) * 60;
                canvasContext.fillStyle = `hsl(${hue}, 100%, 50%)`;
                canvasContext.shadowBlur = 10;
                canvasContext.shadowColor = `hsl(${hue}, 100%, 70%)`;
                // canvasの下部にプログレスバーが表示されるため、カラーバーのY位置を調整する必要はない
                canvasContext.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 2;
            }
        }

        // 曲の再生に合わせてprogressControlの値を更新
        if (source && source.buffer && audioContext && audioContext.state === 'running' && source.startTimeWhenStarted !== undefined && !isDraggingProgress) {
            const elapsedTime = audioContext.currentTime - source.startTimeWhenStarted;
            if (elapsedTime >= 0 && elapsedTime <= source.buffer.duration) {
                progressControl.value = elapsedTime;

                // CSSカスタムプロパティで進捗バーの色を動的に変更
                let avgHueComponent = 0;
                let significantBars = 0;
                if (dataArray && dataArray.length > 0 && bufferLength > 0) {
                    for (let j = 0; j < bufferLength; j++) {
                        if (dataArray[j] > 10) {
                            avgHueComponent += (180 + (dataArray[j] / 255) * 60);
                            significantBars++;
                        }
                    }
                    if (significantBars > 0) {
                        const avgHue = avgHueComponent / significantBars;
                        progressControl.style.setProperty('--progress-track-color', `hsl(${avgHue}, 100%, 50%)`);
                    } else {
                        progressControl.style.setProperty('--progress-track-color', '#0ff'); // デフォルト色
                    }
                }
            } else if (elapsedTime > source.buffer.duration) {
                progressControl.value = progressControl.max;
            }
        }

        // h1のフォントサイズを調整
        if (h1Element && canvas) {
            const visualizerWidth = canvas.offsetWidth;
            // 基本フォントサイズと、コンテナ幅に対する割合でフォントサイズを決定
            // この値はデザインに合わせて調整してください
            const baseFontSize = 10; // 最小フォントサイズ (px)
            const widthRatio = 0.05; // コンテナ幅に対するフォントサイズの割合
            let newFontSize = baseFontSize + visualizerWidth * widthRatio;

            // PC表示時の最大フォントサイズ制限（CSSの@mediaと合わせるか、ここで調整）
            const maxFontSizePc = 48;
            if (window.innerWidth >= 800 && newFontSize > maxFontSizePc) {
                newFontSize = maxFontSizePc;
            }
            h1Element.style.fontSize = `${newFontSize}px`;
        }
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    draw();
}

// リサイズ時にもフォントサイズを調整
window.addEventListener('resize', () => {
    if (animationFrameId) { // visualizeが実行中の場合（＝音楽再生中など）はdraw関数内で処理される
        return;
    }
    // visualizeが実行されていない場合（＝初期表示時など）は手動で調整
    if (h1Element && canvas) {
        const visualizerWidth = canvas.offsetWidth;
        const baseFontSize = 10;
        const widthRatio = 0.05;
        let newFontSize = baseFontSize + visualizerWidth * widthRatio;
        const maxFontSizePc = 48;
        if (window.innerWidth >= 800 && newFontSize > maxFontSizePc) {
            newFontSize = maxFontSizePc;
        }
        h1Element.style.fontSize = `${newFontSize}px`;
    }
});

// 初期表示時にもフォントサイズを調整
document.addEventListener('DOMContentLoaded', () => {
    if (h1Element && canvas) {
        const visualizerWidth = canvas.offsetWidth;
        const baseFontSize = 10;
        const widthRatio = 0.05;
        let newFontSize = baseFontSize + visualizerWidth * widthRatio;
        const maxFontSizePc = 48;
        if (window.innerWidth >= 800 && newFontSize > maxFontSizePc) {
            newFontSize = maxFontSizePc;
        }
        h1Element.style.fontSize = `${newFontSize}px`;
    }
});
