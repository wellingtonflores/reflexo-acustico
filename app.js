// ==========================================================================
// 1. STATE MANAGEMENT & TAB NAVIGATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSimulator();
    initCurveLab();
    initQuiz();
});

function initTabs() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Toggle active button
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Toggle active content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });

            // Toggle simulator-only full device mode for iPad
            if (tabId === 'simulator') {
                document.body.classList.add('device-only-active');
            } else {
                document.body.classList.remove('device-only-active');
            }

            // Trigger canvas resizing or redraws if necessary
            if (tabId === 'lab-curvas') {
                updateCurve();
            }
        });
    });

    // Exit device mode button (restores sidebar and returns to prep tab)
    const exitBtn = document.getElementById('btn-exit-device-mode');
    if (exitBtn) {
        exitBtn.addEventListener('click', () => {
            const prepTabBtn = document.getElementById('btn-tab-prep');
            if (prepTabBtn) {
                prepTabBtn.click();
            }
        });
    }
}

// ==========================================================================
// 2. IMITANCIÔMETRO STEP-BY-STEP SIMULATOR
// ==========================================================================
let currentStep = 1;
const totalSteps = 9;
let simulatorActive = true;
let isMutedReflex = false; // Dummy variable for state
let animModeActive = false;
let skipReflexes = false;
let alternativeScreenActive = false;
let savedPreAlternativeStep = null;
let subStep = 0;
let currentTestResults = null;

function generateRandomTestResults() {
    const ecv = (0.6 + Math.random() * 0.6).toFixed(2);
    const peakVal = (0.2 + Math.random() * 0.5).toFixed(2);
    const peakPress = Math.round(-60 + Math.random() * 80);
    const tw = Math.round(80 + Math.random() * 40);

    const freqs = [500, 1000, 2000, 4000];
    const ipsi = {};
    const contra = {};

    freqs.forEach(freq => {
        const ipsiAmp = (0.03 + Math.random() * 0.05).toFixed(2);
        const contraAmp = (0.03 + Math.random() * 0.05).toFixed(2);
        const ipsiDb = [75, 80, 85, 90][Math.floor(Math.random() * 4)];
        const contraDb = [80, 85, 90, 95][Math.floor(Math.random() * 4)];

        ipsi[freq] = { amp: ipsiAmp, db: ipsiDb };
        contra[freq] = { amp: contraAmp, db: contraDb };
    });

    currentTestResults = {
        ecv,
        tw,
        peakVal,
        peakPress,
        ipsi,
        contra
    };
}

function getTympCurvePath(peakPress, peakVal) {
    let d = "";
    for (let i = 0; i <= 100; i++) {
        const percent = i / 100;
        const P = -200 + percent * 400;
        const compliance = (peakVal - 0.05) * Math.exp(-Math.pow((P - peakPress) / 75, 2)) + 0.05;
        const svgX = 30 + percent * 215;
        const svgY = 148 - (compliance / 3.0) * 133;
        if (i === 0) {
            d += `M ${svgX},${svgY}`;
        } else {
            d += ` L ${svgX},${svgY}`;
        }
    }
    return d;
}

const simSteps = {
    1: {
        title: "Passo 1: Apertar “TIMP”",
        description: "Selecione a opção de timpanometria inicial apertando “TIMP” na tela inicial do aparelho para carregar o módulo de teste.",
        note: "Certifique-se de que a preparação inicial (meatoscopia, escolha da oliva) foi feita antes disso.",
        targetSelector: "#btn-timp",
        alertText: "Aperte 'TIMP' na tela do imitanciômetro.",
        getScreenHTML: () => `
            <div class="screen-title">Menu Principal</div>
            <div class="screen-grid-buttons">
                <div class="screen-btn active-target" id="btn-timp">
                    <i class="fa-solid fa-chart-line" style="color: var(--pink-primary)"></i>
                    Tymp
                </div>
                <div class="screen-btn" id="btn-ref-manual">Reflexo manual</div>
                <div class="screen-btn" id="btn-declinio">Declínio do reflexo</div>
                <div class="screen-btn" id="btn-esrt">Monitor ESRT</div>
                <div class="screen-btn" id="btn-etf">ETF</div>
            </div>
        `
    },
    2: {
        title: "Passo 2: Apertar “TY+REF”",
        description: "Agora, selecione o teste combinado de Timpanometria + Reflexo Acústico pressionando “TY+REF” na tela.",
        note: "Esta opção realiza a timpanometria e em seguida mede os reflexos ipsilaterais e contralaterais automaticamente.",
        targetSelector: "#btn-tyref",
        alertText: "Aperte 'TY+REF' para selecionar o teste completo.",
        getScreenHTML: () => `
            <div class="screen-title">Módulo de Teste</div>
            <div class="screen-grid-buttons">
                <div class="screen-btn active-target" id="btn-tyref">TY+REF</div>
                <div class="screen-btn" id="btn-timp-only">TIMP</div>
                <div class="screen-btn">TYMP3</div>
                <div class="screen-btn">TYMP4</div>
                <div class="screen-btn">TYMP5</div>
            </div>
        `
    },
    3: {
        title: "Passo 3: Selecionar a orelha do exame",
        description: "Escolha qual orelha deseja testar primeiro: orelha Direita (Direito) ou orelha Esquerda (Esquerdo). Coloque a sonda no respectivo ouvido.",
        note: "Coloque sempre a sonda no ouvido selecionado e o fone na orelha oposta.",
        targetSelector: ".ear-btn", // permits clicking either Direito or Esquerdo
        alertText: "Selecione 'Direito' ou 'Esquerdo' para iniciar.",
        getScreenHTML: () => `
            <div class="screen-title">Selecionar Orelha</div>
            <div class="screen-row-split ear-select-row">
                <div class="screen-btn active-target ear-btn ear-btn-right" id="btn-direito">Direito</div>
                <div class="screen-btn active-target ear-btn ear-btn-left" id="btn-esquerdo">Esquerdo</div>
            </div>
            <div class="anim-mode-wrapper" style="display:flex; align-items:center; justify-content: center;">
                <input type="checkbox" id="anim-mode"> Modo desenho animado
            </div>
        `
    },
    4: {
        title: "Passo 4: A curva timpanométrica será traçada",
        description: "O imitanciômetro varia a pressão de +200 a -200 daPa e traça a curva de complacência. Aguarde o término.",
        note: "O paciente deve permanecer imóvel, sem falar ou engolir para não distorcer a curva.",
        targetSelector: "#btn-auto-next-4",
        alertText: "Traçando curva timpanométrica... aguarde.",
        getScreenHTML: () => {
            if (animModeActive) {
                return `<div class="screen-plot-container cartoon-screen-active">
                    <div class="cartoon-header" style="display:flex; justify-content:space-between; font-size:2.5cqw; background:#f1f5f9; padding:1.5cqw 2cqw;">
                        <span>Exame Infantil</span>
                        <span style="color:var(--success); font-weight:700;"><i class="fa-solid fa-face-smile"></i> Silêncio</span>
                    </div>
                    <div class="cartoon-animation-area" style="flex-grow:1; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#fff; overflow:hidden;">
                        <div id="cartoon-character" style="font-size:10cqw; transition:transform 0.08s; color:#38bdf8;"><i class="fa-solid fa-cat"></i></div>
                        <div class="cartoon-text" style="font-size:2.8cqw; margin-top:2cqw; font-weight:600; color:#475569;">O gatinho está crescendo!</div>
                    </div>
                    <div class="screen-bottom-bar" style="justify-content:center;">
                        <span class="screen-icon-indicator"><i class="fa-solid fa-spinner fa-spin"></i> Timpanometria...</span>
                    </div>
                </div>`;
            }
            return `<div class="screen-plot-container" style="padding:0;">
                <div class="tymp-result-header">
                    <span style="font-weight:700; color:#1e293b;">YBG</span>
                    <span style="color:#64748b;">226 Hz Ytm</span>
                </div>
                <div class="screen-plot-chart" style="flex-grow:1;">
                    <svg class="screen-plot-svg" viewBox="0 0 260 180" preserveAspectRatio="xMidYMid meet">
                        <text x="25" y="18" font-size="7" fill="#94a3b8" text-anchor="end">3.0</text>
                        <text x="25" y="44" font-size="7" fill="#94a3b8" text-anchor="end">2.4</text>
                        <text x="25" y="70" font-size="7" fill="#94a3b8" text-anchor="end">1.8</text>
                        <text x="25" y="97" font-size="7" fill="#94a3b8" text-anchor="end">1.2</text>
                        <text x="25" y="123" font-size="7" fill="#94a3b8" text-anchor="end">0.6</text>
                        <text x="25" y="150" font-size="7" fill="#94a3b8" text-anchor="end">0</text>
                        <text x="15" y="170" font-size="6" fill="#94a3b8">ml</text>
                        <line x1="30" y1="15" x2="30" y2="148" stroke="#cbd5e1" stroke-width="0.5"/>
                        <line x1="30" y1="148" x2="245" y2="148" stroke="#cbd5e1" stroke-width="0.5"/>
                        <text x="30" y="160" font-size="6" fill="#94a3b8" text-anchor="middle">-200</text>
                        <text x="84" y="160" font-size="6" fill="#94a3b8" text-anchor="middle">-100</text>
                        <text x="138" y="160" font-size="6" fill="#94a3b8" text-anchor="middle">0</text>
                        <text x="191" y="160" font-size="6" fill="#94a3b8" text-anchor="middle">100</text>
                        <text x="245" y="160" font-size="6" fill="#94a3b8" text-anchor="middle">200</text>
                        <text x="138" y="173" font-size="6" fill="#94a3b8" text-anchor="middle">daPa</text>
                        <line x1="30" y1="15" x2="245" y2="15" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                        <line x1="30" y1="41" x2="245" y2="41" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                        <line x1="30" y1="67" x2="245" y2="67" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                        <line x1="30" y1="93" x2="245" y2="93" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                        <line x1="30" y1="119" x2="245" y2="119" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                        <line x1="84" y1="15" x2="84" y2="148" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                        <line x1="138" y1="15" x2="138" y2="148" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                        <line x1="191" y1="15" x2="191" y2="148" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                        <rect x="112" y="80" width="50" height="42" fill="rgba(16,185,129,0.05)" stroke="rgba(16,185,129,0.25)" stroke-width="0.5" stroke-dasharray="3"/>
                        <path id="live-curve" d="" fill="none" stroke="#dc2626" stroke-width="1.5"/>
                        <circle id="peak-marker" cx="0" cy="0" r="2.5" fill="#0284c7" style="display:none;"/>
                    </svg>
                </div>
                <div id="tymp-result-bar" style="display:none; font-size:2.2cqw; padding:1cqw 2cqw; background:#f8fafc; border-top:1px solid #e2e8f0;">
                    ECV: <strong id="res-ecv">0.75</strong> ml &nbsp; TW: <strong id="res-tw">107</strong> daPa &nbsp; Peak: <strong id="res-peak">0.26</strong> ml / <strong id="res-press">-25</strong> daPa
                </div>
                <div id="tymp-status-bar" class="screen-bottom-bar" style="justify-content:center; font-size:2.2cqw;">
                    <span class="screen-icon-indicator"><i class="fa-solid fa-spinner fa-spin"></i> Medindo...</span>
                </div>
            </div>`;
        }
    },
    5: {
        title: "Passo 5: Reflexo ipsilateral em curso",
        description: "O aparelho pesquisa os reflexos acústicos ipsilaterais automaticamente. Aguarde a verificação de 500, 1000, 2000 e 4000 Hz.",
        note: "O traço de onda no gráfico mostra a resposta reflexa para cada frequência a 80 dB HL.",
        targetSelector: "#btn-auto-next-5",
        alertText: "Pesquisando reflexos ipsilaterais... aguarde.",
        getScreenHTML: () => {
            if (animModeActive) {
                return `<div class="screen-plot-container cartoon-screen-active">
                    <div class="cartoon-header" style="display:flex; justify-content:space-between; font-size:2.5cqw; background:#f1f5f9; padding:1.5cqw 2cqw;">
                        <span>Exame Infantil: IPSI</span>
                        <span style="color:var(--success); font-weight:700;"><i class="fa-solid fa-volume-high"></i> Ouvindo Sons</span>
                    </div>
                    <div class="cartoon-animation-area" style="flex-grow:1; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#fff; overflow:hidden;">
                        <div id="cartoon-character" style="font-size:10cqw; color:#ec4899; transition:transform 0.3s;"><i class="fa-solid fa-cat"></i></div>
                        <div class="cartoon-text" id="cartoon-text-ipsi" style="font-size:2.8cqw; margin-top:2cqw; font-weight:600; color:#475569;">Alimente o gatinho!</div>
                    </div>
                    <div class="screen-bottom-bar" style="justify-content:center; font-size:2.5cqw; background:#f1f5f9; padding:1cqw 2cqw;">
                        <span id="ipsi-kids-status">Testando...</span>
                    </div>
                </div>`;
            }
            return getReflexScreenHTML('ipsi', true);
        }
    },
    6: {
        title: "Passo 6: Selecione \"contra\"",
        description: "O teste ipsilateral foi concluído. Selecione o modo contralateral clicando no botão \"contra\" na tela do aparelho.",
        note: "O reflexo contralateral estimula pelo fone e capta na orelha com a sonda.",
        targetSelector: "#btn-contra-toggle",
        alertText: "Clique em 'contra' para mudar o modo de reflexo.",
        getScreenHTML: () => getReflexScreenHTML('ipsi-done', false)
    },
    7: {
        title: "Passo 7: Selecione \"play\" para iniciar o contra",
        description: "Pressione o botão play (▶) na barra inferior para iniciar a pesquisa do reflexo contralateral.",
        note: "O estímulo será emitido pelo fone de ouvido de forma crescente até detectar o limiar.",
        targetSelector: "#btn-reflex-play",
        alertText: "Clique no play (▶) para iniciar o contralateral.",
        getScreenHTML: () => getReflexScreenHTML('contra-ready', false)
    },
    8: {
        title: "Passo 8: Pare e grave os dados",
        description: "Pressione o quadrado (■) para parar a medição. Depois confirme a gravação dos dados clicando em \"Sim\".",
        note: "Grave sempre os dados imediatamente para não perdê-los.",
        targetSelector: "#btn-reflex-stop",
        alertText: "Clique no quadrado (■) para parar.",
        getScreenHTML: () => getReflexScreenHTML('contra-done', false)
    },
    9: {
        title: "Passo 9: Reveja a timpanometria e anote os resultados",
        description: "Selecione a gravação \"Tymp226\" no histórico para visualizar a curva e anotar os valores de ECV, Peak e TW.",
        note: "Parabéns! Anote os valores e desenhe a curva no prontuário do paciente.",
        targetSelector: "#btn-tymp226-log",
        alertText: "Selecione 'Tymp226' para rever os resultados.",
        getScreenHTML: () => `
            <div class="screen-title">Histórico de Exames</div>
            <div class="history-list-wrapper" style="flex-grow:1; display:flex; flex-direction:column; overflow-y:auto; padding:2px;">
                <div class="screen-btn active-target history-item-btn" id="btn-tymp226-log" style="flex-direction:row; justify-content:space-between;">
                    <span>Tymp226 (11:18)</span>
                    <i class="fa-solid fa-circle-check" style="color:var(--success)"></i>
                </div>
                <div class="screen-btn history-item-btn" style="flex-direction:row; justify-content:space-between;">
                    <span>Reflexo (11:21)</span>
                    <i class="fa-solid fa-circle-check" style="color:var(--success)"></i>
                </div>
            </div>
        `
    }
};

// Helper: generates the unified reflex screen HTML
function getReflexScreenHTML(mode, isAnimating) {
    const ipsiActive = mode === 'ipsi' || mode === 'ipsi-done';
    const contraActive = mode === 'contra-ready' || mode === 'contra-done' || mode === 'contra-anim';
    const ipsiDone = mode === 'ipsi-done' || contraActive;
    const contraDone = mode === 'contra-done';
    const showPlay = mode === 'contra-ready';
    const showStop = mode === 'contra-done';

    const ipsiToggleClass = ipsiActive && !contraActive ? 'reflex-toggle active' : 'reflex-toggle';
    const contraToggleClass = contraActive ? 'reflex-toggle active' : 'reflex-toggle';
    const ipsiDotClass = ipsiActive && !contraActive ? 'reflex-dot active' : 'reflex-dot';
    const contraDotClass = contraActive ? 'reflex-dot active-contra' : 'reflex-dot';

    const playStyle = showPlay
        ? 'class="screen-small-btn play-btn active-target" id="btn-reflex-play"'
        : 'class="screen-small-btn play-btn" style="opacity:0.4; pointer-events:none;"';
    const stopStyle = showStop
        ? 'class="screen-small-btn stop-btn active-target" id="btn-reflex-stop"'
        : (mode === 'ipsi' || mode === 'contra-anim'
            ? 'class="screen-small-btn stop-btn" style="opacity:0.4; pointer-events:none;"'
            : 'class="screen-small-btn stop-btn"');

    const checkDisplay = ipsiDone ? '' : 'display:none;';
    const dbDisplay = ipsiDone ? '' : 'display:none;';
    
    // Read from currentTestResults state
    const ipsiLast = currentTestResults ? currentTestResults.ipsi[4000] : { amp: '0.05', db: '80' };
    const contraLast = currentTestResults ? currentTestResults.contra[4000] : { amp: '0.05', db: '85' };

    const ampText = isAnimating ? '---' : (mode === 'ipsi-done' ? ipsiLast.amp : (contraDone ? contraLast.amp : '---'));
    const dbText = mode === 'ipsi-done' ? ipsiLast.db : (contraDone ? contraLast.db : '80');
    const freqText = isAnimating ? '500 Hz' : '4000 Hz';

    return `<div class="reflex-screen">
        <div class="reflex-header">
            <span style="font-weight:700;">Reflexo</span>
            <span style="font-size:2cqw; color:#64748b;">1dB</span>
        </div>
        <div class="reflex-body">
            <div class="reflex-graph">
                <svg id="reflex-svg" viewBox="0 0 130 80" preserveAspectRatio="xMidYMid meet">
                    <text x="14" y="12" font-size="5" fill="#94a3b8" text-anchor="end">0.20</text>
                    <text x="14" y="30" font-size="5" fill="#94a3b8" text-anchor="end">0.15</text>
                    <text x="14" y="48" font-size="5" fill="#94a3b8" text-anchor="end">0.10</text>
                    <text x="14" y="66" font-size="5" fill="#94a3b8" text-anchor="end">0.05</text>
                    <line x1="16" y1="10" x2="125" y2="10" stroke="#f1f5f9" stroke-width="0.3"/>
                    <line x1="16" y1="28" x2="125" y2="28" stroke="#f1f5f9" stroke-width="0.3"/>
                    <line x1="16" y1="46" x2="125" y2="46" stroke="#f1f5f9" stroke-width="0.3"/>
                    <line x1="16" y1="64" x2="125" y2="64" stroke="#f1f5f9" stroke-width="0.3"/>
                    <line x1="16" y1="8" x2="16" y2="72" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="16" y1="72" x2="125" y2="72" stroke="#cbd5e1" stroke-width="0.5"/>
                    <text x="70" y="79" font-size="5" fill="#94a3b8" text-anchor="middle">ttm</text>
                    <g id="reflex-traces">
                        ${ipsiDone ? getIpsiTraceSVG() : ''}
                        ${contraDone ? getContraTraceSVG() : ''}
                    </g>
                </svg>
            </div>
            <div class="reflex-info">
                <div id="reflex-amp" class="reflex-amp-value">${ampText}</div>
                <div id="reflex-check" class="reflex-check-icon" style="${checkDisplay}"><i class="fa-solid fa-check"></i></div>
                <div id="reflex-db" class="reflex-db-value" style="${dbDisplay}">${dbText}<br><span class="reflex-db-unit">dB HL</span></div>
            </div>
        </div>
        <div class="reflex-toggle-row">
            <span class="${ipsiToggleClass}" id="btn-ipsi-toggle"><span class="${ipsiDotClass}"></span> ipsi</span>
            <span class="${contraToggleClass}" id="btn-contra-toggle"><span class="${contraDotClass}"></span> contra</span>
        </div>
        <div class="reflex-info-row">
            <span><i class="fa-solid fa-volume-high" style="color:var(--pink-primary);"></i> <span id="reflex-freq">${freqText}</span></span>
            <span>-25 daPa</span>
        </div>
        <div class="reflex-controls">
            <div ${playStyle}><i class="fa-solid fa-play"></i></div>
            <div class="screen-small-btn" style="opacity:0.4; pointer-events:none;"><i class="fa-solid fa-forward-step"></i></div>
            <div ${stopStyle}><i class="fa-solid fa-square"></i></div>
        </div>
    </div>`;
}

// Helper: SVG traces for completed ipsi reflexes
function getIpsiTraceSVG() {
    const colors = ['#22c55e', '#84cc16', '#eab308', '#f97316'];
    const freqs = [500, 1000, 2000, 4000];
    let svg = '';
    for (let i = 0; i < 4; i++) {
        const xStart = 20 + i * 25;
        const yBase = 60 - i * 3;
        const amp = currentTestResults ? parseFloat(currentTestResults.ipsi[freqs[i]].amp) : 0.05;
        const deflection = amp * 120;
        svg += `<path d="M${xStart},${yBase} L${xStart+3},${yBase} L${xStart+5},${yBase + deflection} L${xStart+8},${yBase + deflection * 0.75} L${xStart+12},${yBase + deflection * 0.15} L${xStart+18},${yBase}" fill="none" stroke="${colors[i]}" stroke-width="1" opacity="0.9"/>`;
    }
    return svg;
}

// Helper: SVG traces for completed contra reflexes
function getContraTraceSVG() {
    const colors = ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'];
    const freqs = [500, 1000, 2000, 4000];
    let svg = '';
    for (let i = 0; i < 4; i++) {
        const xStart = 20 + i * 25;
        const yBase = 48 - i * 3;
        const amp = currentTestResults ? parseFloat(currentTestResults.contra[freqs[i]].amp) : 0.05;
        const deflection = amp * 120;
        svg += `<path d="M${xStart},${yBase} L${xStart+3},${yBase} L${xStart+5},${yBase + deflection} L${xStart+8},${yBase + deflection * 0.75} L${xStart+12},${yBase + deflection * 0.15} L${xStart+18},${yBase}" fill="none" stroke="${colors[i]}" stroke-width="1" opacity="0.9"/>`;
    }
    return svg;
}

// Helper: final tympanometry result screen with full axes
function getFinalResultScreenHTML() {
    const peakPress = currentTestResults ? parseFloat(currentTestResults.peakPress) : -25;
    const peakVal = currentTestResults ? parseFloat(currentTestResults.peakVal) : 0.26;
    const ecv = currentTestResults ? currentTestResults.ecv : '0.75';
    const tw = currentTestResults ? currentTestResults.tw : '107';

    const peakX = 30 + ((peakPress + 200) / 400) * 215;
    const peakY = 148 - (peakVal / 3.0) * 133;
    const curveD = getTympCurvePath(peakPress, peakVal);

    return `<div class="screen-plot-container" style="padding:0;">
        <div class="tymp-result-header">
            <span style="font-weight:700; color:#1e293b;">YBG</span>
            <span style="color:#64748b;">226 Hz Ytm</span>
        </div>
        <div class="screen-plot-chart" style="flex-grow:1;">
            <svg class="screen-plot-svg" viewBox="0 0 260 180" preserveAspectRatio="xMidYMid meet">
                <text x="25" y="18" font-size="7" fill="#94a3b8" text-anchor="end">3.0</text>
                <text x="25" y="44" font-size="7" fill="#94a3b8" text-anchor="end">2.4</text>
                <text x="25" y="70" font-size="7" fill="#94a3b8" text-anchor="end">1.8</text>
                <text x="25" y="97" font-size="7" fill="#94a3b8" text-anchor="end">1.2</text>
                <text x="25" y="123" font-size="7" fill="#94a3b8" text-anchor="end">0.6</text>
                <text x="25" y="150" font-size="7" fill="#94a3b8" text-anchor="end">0</text>
                <text x="15" y="170" font-size="6" fill="#94a3b8">ml</text>
                <line x1="30" y1="15" x2="30" y2="148" stroke="#cbd5e1" stroke-width="0.5"/>
                <line x1="30" y1="148" x2="245" y2="148" stroke="#cbd5e1" stroke-width="0.5"/>
                <text x="30" y="160" font-size="6" fill="#94a3b8" text-anchor="middle">-200</text>
                <text x="84" y="160" font-size="6" fill="#94a3b8" text-anchor="middle">-100</text>
                <text x="138" y="160" font-size="6" fill="#94a3b8" text-anchor="middle">0</text>
                <text x="191" y="160" font-size="6" fill="#94a3b8" text-anchor="middle">100</text>
                <text x="245" y="160" font-size="6" fill="#94a3b8" text-anchor="middle">200</text>
                <text x="138" y="173" font-size="6" fill="#94a3b8" text-anchor="middle">daPa</text>
                <line x1="30" y1="15" x2="245" y2="15" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                <line x1="30" y1="41" x2="245" y2="41" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                <line x1="30" y1="67" x2="245" y2="67" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                <line x1="30" y1="93" x2="245" y2="93" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                <line x1="30" y1="119" x2="245" y2="119" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                <line x1="84" y1="15" x2="84" y2="148" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                <line x1="138" y1="15" x2="138" y2="148" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                <line x1="191" y1="15" x2="191" y2="148" stroke="#f1f5f9" stroke-width="0.3" stroke-dasharray="2"/>
                <rect x="112" y="80" width="50" height="42" fill="rgba(16,185,129,0.05)" stroke="rgba(16,185,129,0.25)" stroke-width="0.5" stroke-dasharray="3"/>
                <path d="${curveD}" fill="none" stroke="#0284c7" stroke-width="1.5"/>
                <circle cx="${peakX}" cy="${peakY}" r="2.5" fill="#0284c7"/>
            </svg>
        </div>
        <div style="font-size:2.2cqw; padding:1.2cqw 2cqw; background:#f8fafc; border-top:1px solid #e2e8f0; line-height:1.6;">
            ECV: <strong>${ecv}</strong> ml &nbsp; TW: <strong>${tw}</strong> daPa<br>
            Peak: <strong>${peakVal}</strong> ml / <strong>${peakPress}</strong> daPa
        </div>
        <div style="display:flex; justify-content:center; padding:1.5cqw 0;">
            <button class="screen-btn active-target" id="btn-complete-sim" style="background:var(--pink-primary); color:#fff; border:none; width:80%;">Finalizar Estudo</button>
        </div>
    </div>`;
}
function initSimulator() {
    loadStep(1);

    document.getElementById('btn-prev-step').addEventListener('click', () => {
        if (currentStep > 1) {
            loadStep(currentStep - 1);
        }
    });

    document.getElementById('btn-restart-sim').addEventListener('click', () => {
        loadStep(1);
    });

    // Botão flutuante de reiniciar o aparelho (iPad)
    const restartDeviceBtn = document.getElementById('btn-restart-device');
    if (restartDeviceBtn) {
        restartDeviceBtn.addEventListener('click', () => {
            loadStep(1);
        });
    }

    // Device click-handler using delegation
    const screenContainer = document.getElementById('screen-content');
    screenContainer.addEventListener('click', (e) => {
        if (!simulatorActive) return;

        // SE UMA TELA ALTERNATIVA ESTIVER ATIVA (fluxo de erro realista)
        if (alternativeScreenActive) {
            if (e.target.closest('#btn-alt-sair')) {
                alternativeScreenActive = false;
                loadStep(savedPreAlternativeStep);
            } else if (e.target.closest('#btn-alt-sim-timp')) {
                alternativeScreenActive = false;
                skipReflexes = true;
                loadStep(3);
            } else if (e.target.closest('#btn-alt-voltar-contra')) {
                alternativeScreenActive = false;
                loadStep(savedPreAlternativeStep);
            } else if (e.target.closest('#btn-alt-reset')) {
                alternativeScreenActive = false;
                skipReflexes = false;
                loadStep(1);
            } else if (e.target.closest('#btn-alt-log-voltar')) {
                alternativeScreenActive = false;
                loadStep(savedPreAlternativeStep);
            }
            return;
        }

        const stepData = simSteps[currentStep];
        if (!stepData) return;

        // Custom validation based on step & subStep
        let targetSelector = stepData.targetSelector;
        if (currentStep === 8) {
            targetSelector = subStep === 0 ? "#btn-reflex-stop" : "#btn-sim-gravar";
        } else if (currentStep === 9) {
            targetSelector = subStep === 0 ? "#btn-tymp226-log" : "#btn-complete-sim";
        }

        const targetElement = e.target.closest(targetSelector);
        
        if (targetElement) {
            // Correct click! Show visual feedback
            targetElement.classList.add('success-flash');

            // Capture cartoon mode state if on step 3
            if (currentStep === 3) {
                const animModeCheckbox = document.getElementById('anim-mode');
                animModeActive = animModeCheckbox ? animModeCheckbox.checked : false;
            }

            document.getElementById('device-alert').innerText = "Excelente! Passo correto.";
            document.getElementById('device-alert').style.color = "var(--success)";
            hideHint();
            
            // Short delay to let the animation play, then go to next step
            setTimeout(() => {
                if (currentStep === 4) {
                    // Handled inside next load
                } else if (currentStep === 7) {
                    // Block clicks and run Contra reflex animation
                    simulatorActive = false;
                    runContraReflexAnimation();
                } else if (currentStep === 8 && subStep === 0) {
                    // Transition to sub-step 1 (Gravar dados? dialog)
                    subStep = 1;
                    screenContainer.innerHTML = `
                        <div class="confirm-dialog-wrapper" style="flex-grow:1; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                            <div class="confirm-dialog" style="background:#fff; border: 1px solid #cbd5e1; width: 100%;">
                                <div class="confirm-dialog-title" style="font-weight:700; text-align:center; color: #1e293b; font-size:3cqw; padding:2cqw;">Gravar dados?</div>
                                <div class="confirm-dialog-buttons" style="display:flex; justify-content:space-around; gap:2cqw; padding:2cqw;">
                                    <button class="screen-btn active-target confirm-dialog-btn confirm-dialog-yes" id="btn-sim-gravar" style="flex-grow:1; padding:2cqw;">Sim</button>
                                    <button class="screen-btn confirm-dialog-btn confirm-dialog-no" id="btn-nao-gravar" style="flex-grow:1; padding:2cqw;">Não</button>
                                </div>
                            </div>
                        </div>
                    `;
                    document.getElementById('step-title').innerText = "Passo 8: Confirme a gravação";
                    document.getElementById('step-description').innerText = "Selecione 'Sim' no visor do aparelho para salvar o resultado do exame na memória.";
                    document.getElementById('device-alert').innerText = "Selecione 'Sim' para salvar.";
                    document.getElementById('device-alert').style.color = "var(--pink-primary)";
                } else if (currentStep === 9 && subStep === 0) {
                    // Transition to sub-step 1 (Show final result plot screen)
                    subStep = 1;
                    screenContainer.innerHTML = getFinalResultScreenHTML();
                    document.getElementById('step-title').innerText = "Passo 9: Anote os resultados e finalize";
                    document.getElementById('step-description').innerText = "Veja a curva timpanométrica completa e os valores (ECV, TW, Peak) na tela. Anote-os no prontuário e clique em 'Finalizar Estudo'.";
                    document.getElementById('device-alert').innerText = "Anote os resultados e clique em 'Finalizar Estudo'.";
                    document.getElementById('device-alert').style.color = "var(--pink-primary)";
                } else if (currentStep === 9 && subStep === 1) {
                    if (!document.body.classList.contains('device-only-active')) {
                        alert("Você concluiu a simulação passo a passo! Agora pratique as curvas no laboratório.");
                    }
                    loadStep(1);
                } else {
                    loadStep(currentStep + 1);
                }
            }, 500);

        } else {
            // Clicou no botão errado: fluxo interativo e realista
            const clickedBtn = e.target.closest('.screen-btn, .screen-small-btn');
            if (clickedBtn) {
                const id = clickedBtn.id;

                // Passo 1: clicou em outro módulo
                if (currentStep === 1 && (id === 'btn-ref-manual' || id === 'btn-declinio' || id === 'btn-esrt' || id === 'btn-etf')) {
                    savedPreAlternativeStep = currentStep;
                    alternativeScreenActive = true;
                    screenContainer.innerHTML = `
                        <div class="screen-title" style="font-size:3.5cqw;">Módulo Indisponível</div>
                        <div style="flex-grow:1; display:flex; flex-direction:column; justify-content:center; align-items:center; padding: 3cqw; text-align:center;">
                            <div style="font-size: 8cqw; color:var(--pink-primary); margin-bottom:2cqw;"><i class="fa-solid fa-triangle-exclamation"></i></div>
                            <div style="font-size:2.8cqw; font-weight:600; color:#475569; margin-bottom:3cqw;">Este módulo não faz parte do protocolo de exame solicitado (Reflexo Acústico + Timpanometria).</div>
                            <button class="screen-btn" id="btn-alt-sair" style="width:80%; padding:2cqw; background:#f1f5f9; border-color:#cbd5e1;">Voltar</button>
                        </div>
                    `;
                    return;
                }

                // Passo 2: clicou em apenas Timpanometria (TIMP)
                if (currentStep === 2 && id === 'btn-timp-only') {
                    savedPreAlternativeStep = currentStep;
                    alternativeScreenActive = true;
                    screenContainer.innerHTML = `
                        <div class="screen-title" style="font-size:3.5cqw;">Aviso de Protocolo</div>
                        <div style="flex-grow:1; display:flex; flex-direction:column; justify-content:center; align-items:center; padding: 3cqw; text-align:center;">
                            <div style="font-size: 8cqw; color:#f59e0b; margin-bottom:2cqw;"><i class="fa-solid fa-circle-info"></i></div>
                            <div style="font-size:2.8cqw; font-weight:600; color:#475569; margin-bottom:3cqw;">Ao selecionar apenas "TIMP", a pesquisa de reflexos ipsi e contra não será executada. Tem certeza?</div>
                            <div style="display:flex; gap:2cqw; width:100%;">
                                <button class="screen-btn" id="btn-alt-sim-timp" style="flex-grow:1; padding:2cqw; background:#fee2e2; border-color:#fecaca; color:#b91c1c;">Sim</button>
                                <button class="screen-btn" id="btn-alt-sair" style="flex-grow:1; padding:2cqw; background:#d1fae5; border-color:#a7f3d0; color:#065f46;">Não</button>
                            </div>
                        </div>
                    `;
                    return;
                }

                // Passo 6: clicou no botão ipsi (já finalizado) ao invés de contra
                if (currentStep === 6 && clickedBtn.innerText.trim() === 'ipsi') {
                    savedPreAlternativeStep = currentStep;
                    alternativeScreenActive = true;
                    screenContainer.innerHTML = `
                        <div class="screen-plot-container">
                            <div class="screen-plot-data" style="justify-content:space-around;">
                                <span style="color:var(--success)"><i class="fa-solid fa-check"></i> IPSI REVISÃO</span>
                            </div>
                            <div class="ipsi-grid" style="flex-grow: 1; display:grid; grid-template-columns: 1fr 1fr; align-content: center; font-size:2.8cqw; padding:2cqw; gap:1cqw;">
                                <div>500 Hz: <span style="color:var(--success)"><i class="fa-solid fa-check"></i> 80 dB HL</span></div>
                                <div>1000 Hz: <span style="color:var(--success)"><i class="fa-solid fa-check"></i> 80 dB HL</span></div>
                                <div>2000 Hz: <span style="color:var(--success)"><i class="fa-solid fa-check"></i> 80 dB HL</span></div>
                                <div>4000 Hz: <span style="color:var(--success)"><i class="fa-solid fa-check"></i> 80 dB HL</span></div>
                            </div>
                            <div class="screen-bottom-bar" style="margin: 2cqw 0;">
                                <div class="screen-btn" style="flex-grow:1; padding:2cqw; background:#d1fae5;">ipsi</div>
                                <div class="screen-btn" id="btn-alt-voltar-contra" style="flex-grow:1; padding:2cqw; border-color:var(--pink-primary);">contra</div>
                            </div>
                        </div>
                    `;
                    return;
                }

                // Passo 7: clicou em parar/stop
                if (currentStep === 7 && clickedBtn.classList.contains('stop-btn')) {
                    savedPreAlternativeStep = currentStep;
                    alternativeScreenActive = true;
                    screenContainer.innerHTML = `
                        <div class="confirm-dialog-wrapper" style="flex-grow:1; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                            <div class="confirm-dialog" style="background:#fff; border: 1px solid #cbd5e1; width: 100%; text-align:center; padding:3cqw;">
                                <div class="confirm-dialog-title" style="font-weight:700; color: #ef4444; font-size:3.2cqw; margin-bottom:2cqw;"><i class="fa-solid fa-triangle-exclamation"></i> Abortar Exame?</div>
                                <div style="font-size:2.8cqw; color:#475569; margin-bottom:3cqw;">Deseja descartar todos os dados coletados e reiniciar?</div>
                                <div style="display:flex; gap:2cqw; width:100%;">
                                    <button class="screen-btn confirm-dialog-btn confirm-dialog-no" id="btn-alt-reset" style="flex-grow:1; padding:2cqw;">Sim</button>
                                    <button class="screen-btn confirm-dialog-btn confirm-dialog-yes" id="btn-alt-sair" style="flex-grow:1; padding:2cqw;">Não</button>
                                </div>
                            </div>
                        </div>
                    `;
                    return;
                }

                // Passo 8, sub-step 1: clicou em "Não" ao invés de "Sim" para gravar dados
                if (currentStep === 8 && subStep === 1 && id === 'btn-nao-gravar') {
                    savedPreAlternativeStep = currentStep;
                    alternativeScreenActive = true;
                    screenContainer.innerHTML = `
                        <div class="confirm-dialog-wrapper" style="flex-grow:1; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                            <div class="confirm-dialog" style="background:#fff; border: 1px solid #cbd5e1; width: 100%; text-align:center; padding:3cqw;">
                                <div class="confirm-dialog-title" style="font-weight:700; color: #ef4444; font-size:3.2cqw; margin-bottom:2cqw;"><i class="fa-solid fa-circle-xmark"></i> Exame Descartado!</div>
                                <div style="font-size:2.8cqw; color:#475569; margin-bottom:3cqw;">Os dados coletados não foram salvos e foram apagados.</div>
                                <button class="screen-btn confirm-dialog-btn confirm-dialog-yes" id="btn-alt-reset" style="width:100%; padding:2cqw;">Iniciar Novo Exame</button>
                            </div>
                        </div>
                    `;
                    return;
                }

                // Passo 9, sub-step 0: escolheu rever histórico de Reflexos ao invés de timpanometria Tymp226
                if (currentStep === 9 && subStep === 0 && clickedBtn.innerText.includes('Reflexo')) {
                    savedPreAlternativeStep = currentStep;
                    alternativeScreenActive = true;
                    screenContainer.innerHTML = `
                        <div class="screen-title" style="font-size:3.5cqw;">Limiares de Reflexo</div>
                        <div style="flex-grow:1; display:flex; flex-direction:column; gap:2cqw; font-size:2.6cqw; padding:2cqw;">
                            <table style="width:100%; border-collapse:collapse; text-align:center; font-size:2.6cqw;">
                                <thead>
                                    <tr style="background:#cbd5e1; font-weight:700;">
                                        <th style="padding:1cqw;">Modo</th>
                                        <th>500</th>
                                        <th>1K</th>
                                        <th>2K</th>
                                        <th>4K</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="font-weight:600; padding:1cqw;">IPSI</td>
                                        <td>80</td>
                                        <td>80</td>
                                        <td>80</td>
                                        <td>80</td>
                                    </tr>
                                    <tr>
                                        <td style="font-weight:600; padding:1cqw;">CONTRA</td>
                                        <td>85</td>
                                        <td>85</td>
                                        <td>85</td>
                                        <td>85</td>
                                    </tr>
                                </tbody>
                            </table>
                            <button class="screen-btn" id="btn-alt-log-voltar" style="width:100%; padding:2cqw; margin-top:2cqw; background:#f1f5f9;">Voltar ao Histórico</button>
                        </div>
                    `;
                    return;
                }

                // Se clicou em outro botão incorreto genérico, pisca em vermelho
                clickedBtn.classList.add('error-flash');
                setTimeout(() => clickedBtn.classList.remove('error-flash'), 400);
            }
            
            document.getElementById('device-alert').innerText = "Oops! Clique no botão correto.";
            document.getElementById('device-alert').style.color = "var(--danger)";
            
            // Apenas exibe a dica de clique se não estiver no modo realista (iPad)
            if (!document.body.classList.contains('device-only-active')) {
                showHint();
            }
        }
    });
}

function loadStep(stepNum) {
    currentStep = stepNum;
    subStep = 0;
    simulatorActive = true;
    hideHint();

    if (stepNum === 1) {
        skipReflexes = false;
        alternativeScreenActive = false;
        generateRandomTestResults();
    }

    const stepData = simSteps[currentStep];
    if (!stepData) return;

    // Update instruction panel
    document.getElementById('step-title').innerText = stepData.title;
    document.getElementById('step-description').innerText = stepData.description;
    document.getElementById('step-note').querySelector('span').innerText = stepData.note;

    // Update Progress Bar
    const progressPercent = (currentStep / totalSteps) * 100;
    document.getElementById('sim-progress-fill').style.width = `${progressPercent}%`;
    document.getElementById('sim-progress-text').innerText = `Passo ${currentStep} de ${totalSteps}`;

    // Toggle Previous Button state
    document.getElementById('btn-prev-step').disabled = currentStep === 1;

    // Set screen HTML
    const screenContent = document.getElementById('screen-content');
    screenContent.innerHTML = stepData.getScreenHTML();
    
    // Update screen clock according to step images
    const screenTime = document.getElementById('screen-time');
    if (currentStep <= 1) screenTime.innerText = "11:17";
    else if (currentStep <= 4) screenTime.innerText = "11:18";
    else if (currentStep <= 6) screenTime.innerText = "11:20";
    else screenTime.innerText = "11:22";

    document.getElementById('device-alert').innerText = stepData.alertText;
    document.getElementById('device-alert').style.color = "var(--pink-primary)";

    // Special logic for automatic steps that simulate work (Steps 4, 5)
    if (currentStep === 4) {
        simulatorActive = false; // block clicks
        runTympPlotAnimation();
    } else if (currentStep === 5) {
        simulatorActive = false;
        runIpsiReflexAnimation();
    }
}

// SIMULATION ANIMATIONS
function runTympPlotAnimation() {
    const liveCurve = document.getElementById('live-curve');
    const liveP = document.getElementById('live-p');
    const liveC = document.getElementById('live-c');
    let progress = 0;

    const peakProgressPercent = (200 - parseFloat(currentTestResults.peakPress)) / 400;
    const peakVal = parseFloat(currentTestResults.peakVal);

    const interval = setInterval(() => {
        progress += 4;
        
        // Map pressure from +200 to -200
        const currentPressure = Math.round(200 - (progress / 100) * 400);
        // Complacência rises and falls based on dynamic peak position and peak value
        const xPercent = progress / 100;
        const currentCompliance = ((peakVal - 0.05) * Math.exp(-Math.pow((xPercent - peakProgressPercent) * 4, 2)) + 0.05).toFixed(2);

        if (liveP) liveP.innerText = currentPressure;
        if (liveC) liveC.innerText = currentCompliance;

        // Draw SVG Path incrementally if in standard mode
        if (liveCurve) {
            const svgX = 30 + (progress / 100) * 215;
            const svgY = 148 - (currentCompliance / 3.0) * 133;
            
            if (progress === 4) {
                liveCurve.setAttribute('d', `M ${svgX},${svgY}`);
            } else {
                const currentD = liveCurve.getAttribute('d');
                liveCurve.setAttribute('d', `${currentD} L ${svgX},${svgY}`);
            }
        }

        // Animates character scale in Cartoon Mode
        if (animModeActive) {
            const char = document.getElementById('cartoon-character');
            if (char) {
                const scale = 1 + (progress / 100) * 1.2;
                char.style.transform = `scale(${scale})`;
            }
        }

        if (progress >= 100) {
            clearInterval(interval);
            
            const resEcv = document.getElementById('res-ecv');
            const resTw = document.getElementById('res-tw');
            const resPeak = document.getElementById('res-peak');
            const resPress = document.getElementById('res-press');
            if (resEcv) resEcv.innerText = currentTestResults.ecv;
            if (resTw) resTw.innerText = currentTestResults.tw;
            if (resPeak) resPeak.innerText = currentTestResults.peakVal;
            if (resPress) resPress.innerText = currentTestResults.peakPress;

            const resultBar = document.getElementById('tymp-result-bar');
            const statusBar = document.getElementById('tymp-status-bar');
            if (resultBar) resultBar.style.display = 'block';
            if (statusBar) statusBar.style.display = 'none';
            
            const peakMarker = document.getElementById('peak-marker');
            if (peakMarker) {
                const peakX = 30 + peakProgressPercent * 215;
                const peakY = 148 - (peakVal / 3.0) * 133;
                peakMarker.setAttribute('cx', peakX);
                peakMarker.setAttribute('cy', peakY);
                peakMarker.style.display = 'block';
            }

            document.getElementById('device-alert').innerText = "Curva traçada. Avançando...";
            document.getElementById('device-alert').style.color = "var(--success)";
            setTimeout(() => {
                if (skipReflexes) {
                    loadStep(8); // Em modo TIMP-only, pula direto para salvar (Passo 8)
                } else {
                    loadStep(5);
                }
            }, 1500);
        }
    }, 60);
}

function runIpsiReflexAnimation() {
    const freqs = [500, 1000, 2000, 4000];
    let freqIdx = 0;

    function testNextFrequency() {
        if (freqIdx >= freqs.length) {
            document.getElementById('device-alert').innerText = "Ipsi concluído. Avançando...";
            document.getElementById('device-alert').style.color = "var(--success)";
            setTimeout(() => {
                loadStep(6);
            }, 1500);
            return;
        }

        const currentFreq = freqs[freqIdx];
        const ipsiData = currentTestResults.ipsi[currentFreq];
        
        // Update on-screen testing indicators
        const freqLabel = document.getElementById('reflex-freq');
        const ampLabel = document.getElementById('reflex-amp');
        const checkIcon = document.getElementById('reflex-check');
        const dbLabel = document.getElementById('reflex-db');

        if (freqLabel) freqLabel.innerText = `${currentFreq} Hz`;
        if (ampLabel) ampLabel.innerText = '---';
        if (checkIcon) checkIcon.style.display = 'none';
        if (dbLabel) dbLabel.style.display = 'none';

        if (animModeActive) {
            const kidsStatus = document.getElementById('ipsi-kids-status');
            if (kidsStatus) {
                kidsStatus.innerHTML = `Testando ${currentFreq} Hz... <i class="fa-solid fa-spinner fa-spin"></i>`;
            }
        }

        setTimeout(() => {
            // Draw trace
            const tracesGroup = document.getElementById('reflex-traces');
            if (tracesGroup) {
                const colors = ['#22c55e', '#84cc16', '#eab308', '#f97316'];
                const xStart = 20 + freqIdx * 25;
                const yBase = 60 - freqIdx * 3;
                const deflection = parseFloat(ipsiData.amp) * 120;

                const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                newPath.setAttribute('d', `M${xStart},${yBase} L${xStart+3},${yBase} L${xStart+5},${yBase + deflection} L${xStart+8},${yBase + deflection * 0.75} L${xStart+12},${yBase + deflection * 0.15} L${xStart+18},${yBase}`);
                newPath.setAttribute('fill', 'none');
                newPath.setAttribute('stroke', colors[freqIdx]);
                newPath.setAttribute('stroke-width', '1');
                newPath.setAttribute('opacity', '0.9');
                tracesGroup.appendChild(newPath);
            }

            // Success feedback
            if (ampLabel) ampLabel.innerText = ipsiData.amp;
            if (checkIcon) checkIcon.style.display = 'block';
            if (dbLabel) {
                dbLabel.innerHTML = `${ipsiData.db}<br><span class="reflex-db-unit">dB HL</span>`;
                dbLabel.style.display = 'block';
            }

            if (animModeActive) {
                const char = document.getElementById('cartoon-character');
                const txt = document.getElementById('cartoon-text-ipsi');
                const kidsStatus = document.getElementById('ipsi-kids-status');
                
                if (kidsStatus) {
                    kidsStatus.innerText = `${currentFreq} Hz OK!`;
                }
                if (char && txt) {
                    char.style.transform = `scale(1.3) rotate(${freqIdx * 15}deg)`;
                    setTimeout(() => {
                        char.style.transform = `scale(1) rotate(0deg)`;
                    }, 400);
                    
                    const treats = ["🐟 peixe", "🥛 leite", "🧶 novelo", "🍗 frango"];
                    txt.innerText = `O gatinho ganhou: ${treats[freqIdx]}!`;
                }
            }

            freqIdx++;
            setTimeout(testNextFrequency, 1000);
        }, 1200);
    }

    testNextFrequency();
}

function runContraReflexAnimation() {
    const freqs = [500, 1000, 2000, 4000];
    let freqIdx = 0;

    function testNextFrequency() {
        if (freqIdx >= freqs.length) {
            document.getElementById('device-alert').innerText = "Contra concluído. Avançando...";
            document.getElementById('device-alert').style.color = "var(--success)";
            setTimeout(() => {
                loadStep(8);
            }, 1500);
            return;
        }

        const currentFreq = freqs[freqIdx];
        const contraData = currentTestResults.contra[currentFreq];
        
        // Update on-screen testing indicators
        const freqLabel = document.getElementById('reflex-freq');
        const ampLabel = document.getElementById('reflex-amp');
        const checkIcon = document.getElementById('reflex-check');
        const dbLabel = document.getElementById('reflex-db');

        if (freqLabel) freqLabel.innerText = `${currentFreq} Hz`;
        if (ampLabel) ampLabel.innerText = '---';
        if (checkIcon) checkIcon.style.display = 'none';
        if (dbLabel) dbLabel.style.display = 'none';

        if (animModeActive) {
            const kidsStatus = document.getElementById('contra-kids-status');
            if (kidsStatus) {
                kidsStatus.innerHTML = `Testando ${currentFreq} Hz... <i class="fa-solid fa-spinner fa-spin"></i>`;
            }
        }

        setTimeout(() => {
            // Draw trace
            const tracesGroup = document.getElementById('reflex-traces');
            if (tracesGroup) {
                const colors = ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'];
                const xStart = 20 + freqIdx * 25;
                const yBase = 48 - freqIdx * 3;
                const deflection = parseFloat(contraData.amp) * 120;

                const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                newPath.setAttribute('d', `M${xStart},${yBase} L${xStart+3},${yBase} L${xStart+5},${yBase + deflection} L${xStart+8},${yBase + deflection * 0.75} L${xStart+12},${yBase + deflection * 0.15} L${xStart+18},${yBase}`);
                newPath.setAttribute('fill', 'none');
                newPath.setAttribute('stroke', colors[freqIdx]);
                newPath.setAttribute('stroke-width', '1');
                newPath.setAttribute('opacity', '0.9');
                tracesGroup.appendChild(newPath);
            }

            // Success feedback
            if (ampLabel) ampLabel.innerText = contraData.amp;
            if (checkIcon) checkIcon.style.display = 'block';
            if (dbLabel) {
                dbLabel.innerHTML = `${contraData.db}<br><span class="reflex-db-unit">dB HL</span>`;
                dbLabel.style.display = 'block';
            }

            if (animModeActive) {
                const char = document.getElementById('cartoon-character');
                const txt = document.getElementById('cartoon-text-contra');
                const kidsStatus = document.getElementById('contra-kids-status');
                
                if (kidsStatus) {
                    kidsStatus.innerText = `${currentFreq} Hz OK!`;
                }
                if (char && txt) {
                    char.style.transform = `translateX(${freqIdx % 2 === 0 ? '15px' : '-15px'}) scaleX(${freqIdx % 2 === 0 ? 1 : -1})`;
                    
                    const fishRewards = ["⭐ estrela", "🐚 concha", "🫧 bolha", "👑 coroa"];
                    txt.innerText = `O peixinho encontrou: ${fishRewards[freqIdx]}!`;
                }
            }

            freqIdx++;
            setTimeout(testNextFrequency, 1000);
        }, 1200);
    }

    testNextFrequency();
}


// HINTS ENGINE
function showHint() {
    const stepData = simSteps[currentStep];
    const targetElement = document.querySelector(stepData.targetSelector);
    const hintElement = document.getElementById('click-hint');

    if (targetElement && hintElement) {
        const targetRect = targetElement.getBoundingClientRect();
        const screenRect = document.getElementById('device-screen').getBoundingClientRect();
        
        // Position hint element relative to the screen wrapper
        const topPos = targetRect.top - screenRect.top - 38;
        const leftPos = targetRect.left - screenRect.left + (targetRect.width / 2) - 45;

        hintElement.style.top = `${topPos}px`;
        hintElement.style.left = `${leftPos}px`;
        hintElement.style.display = 'block';
    }
}

function hideHint() {
    document.getElementById('click-hint').style.display = 'none';
}


// ==========================================================================
// 3. CURVE LAB (LABORATÓRIO DE CURVAS TIMPANOMÉTRICAS)
// ==========================================================================
const sliderPressao = document.getElementById('slider-pressao');
const sliderComplacencia = document.getElementById('slider-complacencia');
const valPressao = document.getElementById('val-pressao');
const valComplacencia = document.getElementById('val-complacencia');

let currentCurvePreset = 'A';

function initCurveLab() {
    sliderPressao.addEventListener('input', () => {
        valPressao.innerText = `${sliderPressao.value} daPa`;
        currentCurvePreset = null; // custom curve
        removePresetHighlights();
        updateCurve();
    });

    sliderComplacencia.addEventListener('input', () => {
        valComplacencia.innerText = `${parseFloat(sliderComplacencia.value).toFixed(2)} mL`;
        currentCurvePreset = null;
        removePresetHighlights();
        updateCurve();
    });

    // Preset Buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-pres');
            applyPreset(preset);
        });
    });

    // Apply default
    applyPreset('A');
}

function removePresetHighlights() {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
}

function applyPreset(preset) {
    currentCurvePreset = preset;
    removePresetHighlights();
    document.querySelector(`.preset-btn[data-pres="${preset}"]`).classList.add('active');

    switch (preset) {
        case 'A':
            sliderPressao.value = 0;
            sliderComplacencia.value = 0.8;
            break;
        case 'As':
            sliderPressao.value = -10;
            sliderComplacencia.value = 0.15;
            break;
        case 'Ad':
            sliderPressao.value = 5;
            sliderComplacencia.value = 2.2;
            break;
        case 'B':
            sliderPressao.value = -200; // Flat, but slider sets it
            sliderComplacencia.value = 0.05;
            break;
        case 'C':
            sliderPressao.value = -170;
            sliderComplacencia.value = 0.6;
            break;
    }

    valPressao.innerText = `${sliderPressao.value} daPa`;
    valComplacencia.innerText = `${parseFloat(sliderComplacencia.value).toFixed(2)} mL`;

    updateCurve();
}

function updateCurve() {
    const pressao = parseInt(sliderPressao.value);
    const complacencia = parseFloat(sliderComplacencia.value);
    
    // Map pressure to SVG coordinates
    // SVG x-axis limits: 50 px (-300 daPa) to 350 px (+300 daPa)
    // Scale is: 1 daPa = 0.5 px. Center (0 daPa) is at 200 px.
    const peakX = 200 + (pressao / 300) * 150;
    
    // Map compliance to SVG coordinates
    // SVG y-axis limits: 250 px (0 mL) to 25 px (3 mL)
    // Scale: 3 mL = 225 px, so 1 mL = 75 px.
    const peakY = 250 - (complacencia / 3.0) * 225;

    const pathElement = document.getElementById('graph-curve-path');
    const dotElement = document.getElementById('graph-peak-dot');

    let pathD = "";
    
    // Classify Curve
    let type = "Tipo A";
    let interpretation = "Sistema móvel e pressão preservada.";
    let observation = "Pico de complacência situado na faixa de normalidade (pressão de -100 a +50 daPa; complacência de 0.3 a 1.65 mL). Sugere orelha média livre.";

    // Logic matching the study guide table
    if (currentCurvePreset === 'B' || (complacencia <= 0.20 && currentCurvePreset !== 'As')) {
        // Curve B: Flat curve, no clear peak
        type = "Tipo B";
        interpretation = "Sem pico, sugerindo otite média (presença de líquido) ou perfuração.";
        observation = "Curva timpanométrica horizontalizada (plana), sem ponto de máxima complacência definido. Comum em otites secretoras ou efusões.";
        
        // Draw flat line
        const flatY = 250 - (complacencia / 3.0) * 225;
        pathD = `M 50,${flatY} Q 200,${flatY - 10} 350,${flatY}`;
        
        // Hide peak indicator or set it as translucent
        dotElement.setAttribute('cx', 200);
        dotElement.setAttribute('cy', flatY - 5);
        dotElement.style.opacity = 0.2;
    } else {
        // Normal curve shape
        dotElement.style.opacity = 1;
        dotElement.setAttribute('cx', peakX);
        dotElement.setAttribute('cy', peakY);

        // SVG Path drawing algorithm
        // Base flat lines at the end of the range
        const baseY = 240; // 0.13 mL approx
        
        // Smooth bell curve with control points
        pathD = `M 50,${baseY} C 100,${baseY} ${peakX - 60},${peakY + 15} ${peakX},${peakY} C ${peakX + 60},${peakY + 15} 300,${baseY} 350,${baseY}`;

        // Classification thresholds
        if (pressao < -100) {
            type = "Tipo C";
            interpretation = "Pressão em vácuo (pressão negativa), disfunção tubária.";
            observation = "Pico de complacência deslocado para pressões negativas inferiores a -100 daPa. Sugere início de otite média ou mau funcionamento da Tuba Auditiva.";
        } else if (pressao > 50) {
            // Out of bounds but let's label it based on compliance
            type = "Tipo Especial (Positivo)";
            interpretation = "Pressão da orelha média positiva.";
            observation = "Pico deslocado para zona de pressão positiva. Incomum, às vezes associado a fases agudas iniciais de otite.";
        } else {
            // Pressure is in normal range (-100 to +50 daPa)
            if (complacencia < 0.3) {
                type = "Tipo Ar (As)";
                interpretation = "Sistema rígido (otosclerose, fixação da cadeia ossicular).";
                observation = "Pico de complacência centralizado em pressão normal, porém com amplitude baixa (abaixo de 0.3 mL).";
            } else if (complacencia > 1.65) {
                type = "Tipo Ad";
                interpretation = "Sistema flácido ou disjunção de cadeia ossicular.";
                observation = "Pico de complacência muito alto (acima de 1.65 mL) em pressão normal. Comum em flacidez timpânica ou rompimento dos ossículos.";
            } else {
                type = "Tipo A";
                interpretation = "Sistema móvel e pressão preservada.";
                observation = "Mobilidade normal da membrana timpânica e pressão adequada na orelha média.";
            }
        }
    }

    pathElement.setAttribute('d', pathD);

    // Update Output UI
    const badge = document.getElementById('class-badge');
    badge.innerText = type;
    
    // Change badge color depending on type
    badge.className = "badge-type"; // reset
    if (type === 'Tipo A') badge.style.background = "linear-gradient(135deg, #10b981, #059669)";
    else if (type === 'Tipo B') badge.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
    else if (type === 'Tipo C') badge.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
    else badge.style.background = "linear-gradient(135deg, var(--pink-primary), var(--violet-primary))";

    document.getElementById('class-interpretacao').innerText = interpretation;
    document.getElementById('class-obs').innerText = observation;
}


// ==========================================================================
// 4. QUIZ & FLASHCARDS SYSTEM
// ==========================================================================
let quizMode = "";
let quizQuestions = [];
let quizCurrentIdx = 0;
let quizScore = 0;

const questionBankCurves = [
    {
        question: "Uma complacência menor que 0.3 mL com pressão média normal (+50 a -100 daPa) indica qual curva?",
        options: ["Tipo A", "Tipo Ar (As)", "Tipo Ad", "Tipo B"],
        correct: 1,
        explanation: "O Tipo Ar (As) indica um sistema rígido, com baixa mobilidade (complacência < 0.3 mL), mas com pressão correta."
    },
    {
        question: "Qual alteração clínica é fortemente sugerida pela curva timpanométrica Tipo B (curva plana)?",
        options: ["Otosclerose", "Disfunção tubária", "Presença de líquido na orelha média (otite secretora) ou perfuração", "Disjunção de cadeia ossicular"],
        correct: 2,
        explanation: "A curva Tipo B indica falta de mobilidade completa (plana) do tímpano devido à presença de líquido colado ou perfuração."
    },
    {
        question: "Uma pressão da orelha média abaixo de -100 daPa com complacência de 0.8 mL indica qual curva?",
        options: ["Tipo A", "Tipo B", "Tipo C", "Tipo Ad"],
        correct: 2,
        explanation: "Uma pressão abaixo de -100 daPa (pressão negativa/vácuo) indica curva Tipo C, comum em disfunção tubária."
    },
    {
        question: "Valores normais de complacência (pico de altura da curva) estão compreendidos entre:",
        options: ["0.1 a 0.5 mL", "0.3 a 1.65 mL", "1.0 a 3.0 mL", "Abaixo de 0.3 mL"],
        correct: 1,
        explanation: "Segundo os valores de referência de Jerger, a complacência normal varia de 0.3 a 1.65 mL."
    },
    {
        question: "A curva Tipo Ad possui complacência acima de 1.65 mL e indica clinicamente:",
        options: ["Sistema rígido / Otosclerose", "Membrana flácida ou disjunção de cadeia ossicular", "Otite média aguda", "Tuba auditiva obstruída"],
        correct: 1,
        explanation: "Picos muito altos de complacência (Tipo Ad) ocorrem em sistemas flácidos (cicatrizes) ou quando a cadeia de ossículos está desconectada."
    },
    {
        question: "Qual o valor de referência normal para a pressão da orelha média?",
        options: ["Qualquer valor abaixo de -100 daPa", "Sem pressão definida", "+50 a -100 daPa", "+150 a -300 daPa"],
        correct: 2,
        explanation: "A pressão normal da orelha média deve estar entre +50 e -100 daPa."
    },
    {
        question: "Qual curva apresenta complacência de 0.3 a 1.65 mL com pico de pressão situado em 0 daPa?",
        options: ["Tipo A", "Tipo As", "Tipo C", "Tipo B"],
        correct: 0,
        explanation: "Esta é a definição clássica da curva Tipo A (tímpano-ossicular perfeitamente móvel)."
    },
    {
        question: "Qual destas condições impede (contraindica) a realização da timpanometria?",
        options: ["Presença de zumbido", "Perda auditiva sensorioneural", "Perfuração timpânica ou cirurgia otológica recente", "Dificuldade de fala"],
        correct: 2,
        explanation: "Perfurar o tímpano ou cirurgias recentes impedem a variação artificial de pressão de ar no conduto auditivo."
    },
    {
        question: "Em caso de Otosclerose (fixação do estribo), qual curva é mais comumente esperada?",
        options: ["Tipo Ad", "Tipo A", "Tipo B", "Tipo Ar (As)"],
        correct: 3,
        explanation: "A otosclerose endurece a cadeia de ossículos (sistema rígido), gerando curvas com pico baixo (Tipo Ar ou As)."
    },
    {
        question: "O laudo de um paciente apresenta: 'Curva timpanométrica Tipo Jerger C bilateralmente'. Isso indica:",
        options: ["Orelhas médias saudáveis", "Presença de líquido em ambas as orelhas", "Disfunção tubária / pressão negativa bilateral", "Cadeia ossicular rompida bilateralmente"],
        correct: 2,
        explanation: "Tipo C indica pressão negativa crônica causada pela disfunção tubária."
    }
];

const questionBankSteps = [
    {
        question: "Ao iniciar a execução do teste no imitanciômetro, qual é o primeiro botão que deve ser pressionado?",
        options: ["contra", "TIMP", "play", "TY+REF"],
        correct: 1,
        explanation: "De acordo com o manual passo a passo, o primeiro comando é pressionar o botão 'TIMP' para abrir o módulo de timpanometria."
    },
    {
        question: "No imitanciômetro SENTI, o comando 'TY+REF' serve para:",
        options: ["Apenas medir o volume físico do canal", "Selecionar o teste conjunto de Timpanometria e Reflexo", "Calibrar o fone contralateral", "Excluir o exame anterior"],
        correct: 1,
        explanation: "O botão 'TY+REF' seleciona a realização conjunta de Timpanometria + pesquisa de Reflexos Acústicos."
    },
    {
        question: "Qual orientação deve ser dada ao paciente durante a medição do imitanciômetro?",
        options: ["Mastigar lentamente para aliviar a pressão", "Não falar, não se mexer e não engolir", "Responda 'sim' toda vez que ouvir o barulho", "Girar a cabeça para os lados"],
        correct: 1,
        explanation: "Movimentos da mandíbula ou da laringe ao engolir ou falar geram variações abruptas de pressão no conduto e estragam o teste."
    },
    {
        question: "Após a pesquisa automática do reflexo ipsilateral terminar, qual botão virtual deve ser acionado na tela?",
        options: ["Tymp226", "contra", "play", "quadrado (stop)"],
        correct: 1,
        explanation: "O passo 6 define: 'Ao terminar, aperte contra' para mudar a captação do reflexo para o fone oposto."
    },
    {
        question: "Qual botão inicia a estimulação contralateral no aparelho?",
        options: ["Sim", "quadrado (stop)", "play (ícone de seta azul)", "TIMP"],
        correct: 2,
        explanation: "O passo 7 diz: 'Selecione o play' (sinalizado com um botão azul na parte inferior) para iniciar o estímulo contralateral."
    },
    {
        question: "Após finalizar a coleta do contra, qual botão deve ser pressionado para parar o aparelho e preparar a gravação?",
        options: ["O botão vermelho 'contra'", "O botão com ícone de quadrado (stop)", "O botão 'TIMP'", "O botão de desligar"],
        correct: 1,
        explanation: "Aperte o botão de quadrado (Stop) na parte inferior para encerrar o ciclo de teste e iniciar o salvamento (Passo 9)."
    },
    {
        question: "No Passo 10, o que deve ser feito na caixa de confirmação do imitanciômetro?",
        options: ["Clicar em 'Não' para repetir", "Clicar em 'Cancelar'", "Clicar em 'Sim' para gravar os dados", "Pressionar o botão físico"],
        correct: 2,
        explanation: "O passo 10 exige selecionar 'Sim' para armazenar de forma definitiva as medições feitas na orelha examinada."
    },
    {
        question: "Qual opção do histórico de exames deve ser selecionada para rever a curva timpanométrica de tom convencional?",
        options: ["Tymp1000", "Reflexo", "Tymp226", "Configurações"],
        correct: 2,
        explanation: "Selecione o registro rotulado como 'Tymp226' para analisar a timpanometria padrão sob 226 Hz."
    },
    {
        question: "Se o paciente possuir excesso de cerúmen ou perfuração timpânica, o que deve ser feito?",
        options: ["Realizar o exame normalmente", "Não realizar o exame (contraindicação)", "Usar uma oliva maior e apertar com força", "Fazer apenas o reflexo contralateral"],
        correct: 1,
        explanation: "Estas são contraindicações formais absolutas que impedem a vedação pneumática e podem causar danos."
    },
    {
        question: "Qual o objetivo de prender o grampo da sonda na roupa do paciente (Passo 3)?",
        options: ["Melhorar o sinal elétrico", "Evitar que o peso do cabo puxe a sonda e quebre a vedação no ouvido", "Conectar o terra do aparelho", "Identificar o paciente"],
        correct: 1,
        explanation: "O cabo da sonda é pesado; o grampo de roupa suporta o cabo evitando deslocamentos da oliva durante a variação pneumática."
    }
];

function initQuiz() {
    // Mode selection
    document.querySelectorAll('.quiz-mode-card').forEach(card => {
        card.addEventListener('click', () => {
            quizMode = card.getAttribute('data-mode');
            startQuiz(quizMode);
        });
    });

    document.getElementById('btn-exit-quiz').addEventListener('click', exitQuiz);
    document.getElementById('btn-back-setup').addEventListener('click', exitQuiz);
    document.getElementById('btn-retry-quiz').addEventListener('click', () => startQuiz(quizMode));
    
    document.getElementById('btn-next-question').addEventListener('click', () => {
        quizCurrentIdx++;
        if (quizCurrentIdx < quizQuestions.length) {
            showQuestion();
        } else {
            showResults();
        }
    });
}

function startQuiz(mode) {
    quizScore = 0;
    quizCurrentIdx = 0;
    
    // Select questions bank
    if (mode === "curves") {
        // Shuffle and take 10
        quizQuestions = shuffleArray([...questionBankCurves]).slice(0, 10);
    } else {
        quizQuestions = shuffleArray([...questionBankSteps]).slice(0, 10);
    }

    document.getElementById('quiz-setup').style.display = 'none';
    document.getElementById('quiz-results').style.display = 'none';
    document.getElementById('quiz-play').style.display = 'block';

    showQuestion();
}

function showQuestion() {
    const questionData = quizQuestions[quizCurrentIdx];
    
    // Update question metadata
    document.getElementById('question-num').innerText = quizCurrentIdx + 1;
    document.getElementById('score-val').innerText = quizScore;
    document.getElementById('question-text').innerText = questionData.question;
    
    // Hide next question button & clear feedback
    document.getElementById('btn-next-question').style.display = 'none';
    const feedback = document.getElementById('quiz-feedback');
    feedback.innerText = "";
    feedback.className = "feedback-area";

    // Quiz SVG graphic helper
    const graphPreview = document.getElementById('quiz-graph-preview');
    const miniCurve = document.getElementById('mini-curve');
    
    // Check if we show a graphic (primarily for curves quiz)
    if (quizMode === "curves" && (questionData.question.includes("curva") || questionData.question.includes("Tipo"))) {
        graphPreview.style.display = "block";
        // Customize preview based on question keyword
        if (questionData.question.includes("Tipo B") || questionData.question.includes("plana")) {
            miniCurve.setAttribute('d', "M 20,120 Q 100,115 180,120"); // flat
        } else if (questionData.question.includes("Tipo C") || questionData.question.includes("negativa")) {
            miniCurve.setAttribute('d', "M 20,125 C 50,125 55,60 70,60 C 85,60 110,125 180,125"); // shifted left
        } else if (questionData.question.includes("Ar") || questionData.question.includes("As") || questionData.question.includes("rígido")) {
            miniCurve.setAttribute('d', "M 20,125 C 70,125 90,110 100,110 C 110,110 130,125 180,125"); // low peak
        } else if (questionData.question.includes("Ad") || questionData.question.includes("flácido")) {
            miniCurve.setAttribute('d', "M 20,125 C 70,125 90,20 100,20 C 110,20 130,125 180,125"); // high peak
        } else {
            miniCurve.setAttribute('d', "M 20,125 C 70,125 90,65 100,65 C 110,65 130,125 180,125"); // normal Type A
        }
    } else {
        graphPreview.style.display = "none";
    }

    // Populate options
    const optionsGrid = document.getElementById('quiz-options');
    optionsGrid.innerHTML = "";

    questionData.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = "option-btn";
        btn.innerText = opt;
        btn.addEventListener('click', () => checkQuizAnswer(idx, btn));
        optionsGrid.appendChild(btn);
    });
}

function checkQuizAnswer(selectedIdx, clickedButton) {
    const questionData = quizQuestions[quizCurrentIdx];
    const optionButtons = document.querySelectorAll('.option-btn');
    
    // Disable all options to prevent multiple clicks
    optionButtons.forEach(btn => btn.disabled = true);

    const feedback = document.getElementById('quiz-feedback');

    if (selectedIdx === questionData.correct) {
        // Correct!
        clickedButton.classList.add('correct');
        feedback.innerText = "Correto! " + questionData.explanation;
        feedback.className = "feedback-area correct";
        quizScore++;
        document.getElementById('score-val').innerText = quizScore;
    } else {
        // Wrong!
        clickedButton.classList.add('wrong');
        optionButtons[questionData.correct].classList.add('correct');
        feedback.innerText = "Incorreto. " + questionData.explanation;
        feedback.className = "feedback-area wrong";
    }

    // Show Next Question button
    document.getElementById('btn-next-question').style.display = 'block';
}

function showResults() {
    document.getElementById('quiz-play').style.display = 'none';
    document.getElementById('quiz-results').style.display = 'block';

    document.getElementById('final-correct').innerText = quizScore;
    const percent = (quizScore / 10) * 100;
    document.getElementById('final-percent').innerText = `${percent}%`;

    const msgEl = document.getElementById('results-message');
    if (quizScore >= 9) {
        msgEl.innerText = "Sensacional! Você demonstra excelente domínio tanto do procedimento prático do imitanciômetro quanto dos critérios clínicos de Jerger.";
    } else if (quizScore >= 7) {
        msgEl.innerText = "Muito bom! Bom aproveitamento técnico. Dica: revise as curvas onde as pressões e volumes de complacência se sobrepõem.";
    } else {
        msgEl.innerText = "Continue praticando! Use o Simulador e o Laboratório de Curvas para fixar o funcionamento visual do aparelho e a correlação dos valores de referência.";
    }
}

function exitQuiz() {
    document.getElementById('quiz-play').style.display = 'none';
    document.getElementById('quiz-results').style.display = 'none';
    document.getElementById('quiz-setup').style.display = 'block';
}

// Utility to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
