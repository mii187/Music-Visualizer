const canvas = document.getElementById('visualizer');
const canvasContext = canvas.getContext('2d');
const playButton = document.getElementById('playButton');
const stopButton = document.getElementById('stopButton');
const nextButton = document.getElementById('nextButton');
const rewindButton = document.getElementById('rewindButton');
const volumeControl = document.getElementById('volumeControl');
const progressControl = document.getElementById('progressControl');
const h1Element = document.querySelector('h1');

// ファイルアップロード関連の要素 (今回は非表示)
const audioFileInput = document.getElementById('audioFile');
const uploadProgressContainer = document.querySelector('.upload-progress-container');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const uploadStatus = document.getElementById('uploadStatus');
const thumbnail = document.getElementById('thumbnail');


let audioContext;
let analyser;
let dataArray;
let bufferLength;
let source; // MediaStreamAudioSourceNode または AudioBufferSourceNode
let animationFrameId = null;

// 初期UI設定
document.addEventListener('DOMContentLoaded', () => {
    if (playButton) playButton.textContent = 'マイク集音開始';
    if (stopButton) stopButton.style.display = 'none';

    const fileRelatedUI = [
        audioFileInput,
        thumbnail,
        uploadProgressContainer,
        progressControl,
        nextButton,
        rewindButton
    ];
    fileRelatedUI.forEach(el => {
        if (el) el.style.display = 'none';
    });

    // h1フォントサイズの初期調整
    adjustH1FontSize();
});


playButton.addEventListener('click', async () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    if (source && source.mediaStream) {
        console.log("Microphone already active.");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        source = audioContext.createMediaStreamSource(stream);

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        const gainNode = audioContext.createGain();
        gainNode.gain.value = volumeControl.value;

        source.connect(gainNode);
        gainNode.connect(analyser);
        // analyser.connect(audioContext.destination); // マイク入力をスピーカーに出力しない

        if (!animationFrameId) {
            visualize();
        }

        playButton.style.display = 'none';
        stopButton.style.display = 'inline-block';
        stopButton.textContent = '集音停止';

    } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('マイクへのアクセスに失敗しました。アクセス許可を確認してください。');
        if (audioContext && audioContext.state !== 'closed') {
            // audioContext.close(); // エラー時にコンテキストを閉じる場合
        }
        audioContext = null; // コンテキストをリセット
        playButton.style.display = 'inline-block';
        stopButton.style.display = 'none';
    }
});

stopButton.addEventListener('click', () => {
    if (source && source.mediaStream) { // マイク入力の場合
        source.mediaStream.getTracks().forEach(track => track.stop());
        // source.disconnect(); // 必要に応じて
        source = null;

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        // キャンバスをクリア
        if (canvasContext) {
            canvasContext.fillStyle = '#0f0f0f';
            canvasContext.fillRect(0, 0, canvas.width, canvas.height);
        }

        playButton.style.display = 'inline-block';
        stopButton.style.display = 'none';

        // AudioContextをサスペンドまたはクローズする
        // if (audioContext && audioContext.state === 'running') {
        //     audioContext.suspend();
        // }
        // 長時間使わないなら close も検討
        // if (audioContext) {
        //     audioContext.close().then(() => audioContext = null);
        // }
    }
});

volumeControl.addEventListener('input', (event) => {
    const volume = event.target.value;
    // マイク入力の場合、GainNodeはストリーム開始時に作成・接続されるため、
    // ここでGainNodeを再作成・再接続するか、既存のGainNodeのgain値を変更する。
    // ただし、現状の実装ではマイク開始時にGainNodeが作られるため、
    // マイク起動中にボリュームを変更しても即時反映されない。
    // 即時反映させるには、gainNodeをグローバルにするか、
    // visualizeループ内でgain値を更新するなどの工夫が必要。
    // 簡単な対応として、マイク起動中にボリューム変更されたら、
    // 既存のsourceに接続されているgainNodeの値を変更する。
    if (source && analyser && audioContext) {
        // 簡単のため、一度 analyser から gainNode を辿ることはせず、
        // gainNode をグローバルにするか、playButton クリック時に gainNode を保持する
        // ここでは未対応とする。ボリューム変更はマイク再起動後に有効。
        // もし gainNode がグローバルにあれば:
        // if (gainNode) gainNode.gain.value = volume;
    }
});


function visualize() {
    const barWidth = bufferLength > 0 ? (canvas.width / bufferLength) * 1.2 : 0;
    let x = 0;

    function draw() {
        animationFrameId = requestAnimationFrame(draw);

        if (!canvasContext) return;
        canvasContext.fillStyle = '#0f0f0f';
        canvasContext.fillRect(0, 0, canvas.width, canvas.height);

        if (!analyser || !dataArray) {
            return;
        }

        analyser.getByteFrequencyData(dataArray);
        x = 0;

        if (bufferLength > 0) {
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] * (canvas.height / 255);
                const hue = 180 + (dataArray[i] / 255) * 60; // 青緑から黄色へ
                canvasContext.fillStyle = `hsl(${hue}, 100%, 50%)`;
                canvasContext.shadowBlur = 10;
                canvasContext.shadowColor = `hsl(${hue}, 100%, 70%)`;
                canvasContext.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 2; // バーの間にスペース
            }
        }
        // h1フォントサイズの動的調整
        adjustH1FontSize();
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    draw();
}

function adjustH1FontSize() {
    if (h1Element && canvas) {
        const visualizerWidth = canvas.offsetWidth;
        const baseFontSize = 10;
        const widthRatio = 0.05;
        let newFontSize = baseFontSize + visualizerWidth * widthRatio;
        const maxFontSizePc = 48; // PCでの最大フォントサイズ
        if (window.innerWidth >= 800 && newFontSize > maxFontSizePc) {
            newFontSize = maxFontSizePc;
        }
        h1Element.style.fontSize = `${newFontSize}px`;
    }
}

window.addEventListener('resize', () => {
    // 音楽再生中（visualize実行中）でなくてもフォントサイズを調整
    adjustH1FontSize();
});

// rewindButton, nextButton, progressControl のリスナーは不要なので削除またはコメントアウト
// rewindButton.addEventListener('click', ...);
// nextButton.addEventListener('click', ...);
// if (progressControl) { progressControl.addEventListener('input', ...); }

// initAudio 関数はファイルバッファ用だったので、マイク入力では使用しない
// function initAudio(audioBuffer, startTime = 0) { ... }

// trackSourceStartTime 関数もファイルバッファ用
// function trackSourceStartTime(sourceNode, offset) { ... }
