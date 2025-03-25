// ----------------------
// VARIÁVEIS GLOBAIS E ARMAZENAMENTO
// ----------------------

// Variável para armazenar os campos selecionados (usados para exclusão e edição múltipla)
let selectedCells = new Set();

// Dados das tarefas e cores, persistidos no localStorage
let scheduleData = JSON.parse(localStorage.getItem('scheduleData')) || {};
function saveScheduleData() {
    localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
}

// Array de horários padrão (linhas padrão)
let timeSlots = JSON.parse(localStorage.getItem('timeSlots')) || [];
const startHour = 5;
const endHour = 23;
// Não é mais necessário o timeIncrement, já que usamos apenas minutos 00
function formatTime(hour, minute) {
    const h = hour.toString().padStart(2, '0');
    const m = minute.toString().padStart(2, '0');
    return `${h}:${m}`;
}
if (timeSlots.length === 0) {
    // Gera apenas horários em ponto: 5:00, 6:00, 7:00, ...
    for (let hour = startHour; hour <= endHour; hour++) {
        timeSlots.push(formatTime(hour, 0));
    }
    localStorage.setItem('timeSlots', JSON.stringify(timeSlots));
}

// Array para armazenar as linhas customizadas (adicionadas pelo usuário)
let customRows = JSON.parse(localStorage.getItem('customRows')) || [];
function saveCustomRows() {
    localStorage.setItem('customRows', JSON.stringify(customRows));
}

// ----------------------
// FUNÇÕES AUXILIARES
// ----------------------

// Converte string "HH:MM" em objeto {hour, minute} (ou null se inválido)
function parseTime(input) {
    const parts = input.split(':');
    if (parts.length !== 2) return null;
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    if (isNaN(hour) || isNaN(minute)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour, minute };
}

// Converte uma string de horário ("HH:MM") para minutos desde a meia-noite
function timeToMinutes(timeStr) {
    if (!timeStr) return -1;
    const parsed = parseTime(timeStr);
    if (!parsed) return -1;
    return parsed.hour * 60 + parsed.minute;
}

// ----------------------
// RENDERIZAÇÃO DA TABELA
// ----------------------
const tbody = document.querySelector('#scheduleTable tbody');
const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const colorOptions = [
    "rgb(255, 249, 196)", // Amarelo claro
    "rgb(187, 222, 251)", // Azul claro
    "rgb(200, 230, 201)", // Verde claro
    "rgb(248, 187, 208)", // Rosa claro
    "rgb(225, 190, 231)"  // Roxo claro
];

/**
 * Cria uma linha da tabela.
 * O objeto rowObj deve ter:
 *   - type: "default" ou "custom"
 *   - time: string (pode ser "" para custom sem horário definido)
 *   - Para default: index (posição no array timeSlots)
 *   - Para custom: id (identificador único)
 */
function createRow(rowObj) {
    const tr = document.createElement('tr');
    // Célula de horário (primeira coluna)
    const tdTime = document.createElement('td');
    tdTime.classList.add('time-col');
    tdTime.textContent = rowObj.time ? rowObj.time : "--";
    tdTime.dataset.time = rowObj.time || "";
    tdTime.dataset.rowType = rowObj.type;
    if (rowObj.type === "default") {
        tdTime.dataset.index = rowObj.index;
    } else if (rowObj.type === "custom") {
        tdTime.dataset.id = rowObj.id;
    }

    // Ao clicar com Ctrl, a célula de horário é usada para seleção (para exclusão)
    tdTime.addEventListener('click', function (e) {
        if (e.ctrlKey) {
            tdTime.classList.toggle("selected");
            if (tdTime.classList.contains("selected")) {
                selectedCells.add(tdTime);
            } else {
                selectedCells.delete(tdTime);
            }
            return; // Não prossegue com a edição se estiver selecionando
        }
        e.stopPropagation();
        const oldTime = tdTime.dataset.time || "--";
        const newTimeInput = prompt(`Digite o novo horário para ${oldTime} (formato HH:MM):`, oldTime === "--" ? "" : oldTime);
        if (newTimeInput) {
            const parsed = parseTime(newTimeInput);
            if (parsed) {
                const newFormattedTime = formatTime(parsed.hour, parsed.minute);
                tdTime.textContent = newFormattedTime;
                const previousTime = tdTime.dataset.time;
                tdTime.dataset.time = newFormattedTime;

                // Atualiza o array correspondente
                if (tdTime.dataset.rowType === "default") {
                    const idx = parseInt(tdTime.dataset.index, 10);
                    timeSlots[idx] = newFormattedTime;
                    localStorage.setItem('timeSlots', JSON.stringify(timeSlots));
                } else if (tdTime.dataset.rowType === "custom") {
                    const rowId = tdTime.dataset.id;
                    const customRow = customRows.find(r => r.id === rowId);
                    if (customRow) {
                        customRow.time = newFormattedTime;
                        saveCustomRows();
                    }
                }

                // Atualiza os dados das células de tarefa da linha
                for (let j = 1; j < tr.children.length; j++) {
                    const tdTask = tr.children[j];
                    const day = tdTask.dataset.day;
                    let oldKey, newKey;
                    if (tdTime.dataset.rowType === "default") {
                        oldKey = `${day}-${previousTime}`;
                        newKey = `${day}-${newFormattedTime}`;
                    } else {
                        const rowId = tdTime.dataset.id;
                        oldKey = `${day}-custom-${rowId}-${previousTime}`;
                        newKey = `${day}-custom-${rowId}-${newFormattedTime}`;
                    }
                    tdTask.dataset.time = newFormattedTime;
                    if (scheduleData[oldKey]) {
                        scheduleData[newKey] = scheduleData[oldKey];
                        delete scheduleData[oldKey];
                    }
                }
                saveScheduleData();
                renderRows();
            } else {
                alert("Horário inválido! Use o formato HH:MM (ex: 05:15).");
            }
        }
    });
    tr.appendChild(tdTime);

    // Cria as 7 colunas para as tarefas (uma para cada dia)
    for (let day = 0; day < 7; day++) {
        const td = document.createElement('td');
        td.classList.add('task-cell');
        td.dataset.day = day;
        td.dataset.time = tdTime.dataset.time;

        const cellContent = document.createElement('div');
        cellContent.classList.add('cell-content');

        // Define a chave para os dados da célula
        let cellKey = "";
        if (rowObj.type === "default") {
            cellKey = `${day}-${rowObj.time}`;
        } else {
            cellKey = `${day}-custom-${rowObj.id}-${rowObj.time}`;
        }
        if (scheduleData[cellKey]) {
            cellContent.textContent = scheduleData[cellKey].task || "";
            if (scheduleData[cellKey].color) {
                td.style.backgroundColor = scheduleData[cellKey].color;
            }
        }
        td.appendChild(cellContent);

        // Cria o container do color picker
        const colorPicker = document.createElement('div');
        colorPicker.classList.add('color-picker');
        colorOptions.forEach(color => {
            const swatch = document.createElement('span');
            swatch.classList.add('color-swatch');
            swatch.dataset.color = color;
            swatch.style.backgroundColor = color;
            swatch.addEventListener('click', function (e) {
                e.stopPropagation();
                let key = "";
                if (tdTime.dataset.rowType === "default") {
                    key = `${day}-${tdTime.dataset.time}`;
                } else {
                    key = `${day}-custom-${tdTime.dataset.id}-${tdTime.dataset.time}`;
                }
                if (td.classList.contains("selected") && selectedCells.size > 1) {
                    selectedCells.forEach(cell => {
                        const cellKey = `${cell.dataset.day}-${cell.dataset.rowType === "custom" ? "custom-" + cell.dataset.id + "-" : ""}${cell.dataset.time}`;
                        if (color === cell.style.backgroundColor) {
                            cell.style.backgroundColor = "";
                            scheduleData[cellKey] = scheduleData[cellKey] || {};
                            scheduleData[cellKey].color = "";
                        } else {
                            cell.style.backgroundColor = color;
                            scheduleData[cellKey] = scheduleData[cellKey] || {};
                            scheduleData[cellKey].color = color;
                        }
                    });
                } else {
                    if (color === td.style.backgroundColor) {
                        td.style.backgroundColor = "";
                        scheduleData[cellKey] = scheduleData[cellKey] || {};
                        scheduleData[cellKey].color = "";
                    } else {
                        td.style.backgroundColor = color;
                        scheduleData[cellKey] = scheduleData[cellKey] || {};
                        scheduleData[cellKey].color = color;
                    }
                }
                saveScheduleData();
            });
            colorPicker.appendChild(swatch);
        });
        td.appendChild(colorPicker);

        // Evento para editar a tarefa
        td.addEventListener('click', function (e) {
            if (e.ctrlKey) {
                td.classList.toggle("selected");
                if (td.classList.contains("selected")) {
                    selectedCells.add(td);
                } else {
                    selectedCells.delete(td);
                }
                return;
            }
            if (td.classList.contains("selected") && selectedCells.size > 1) {
                const currentTask = cellContent.textContent;
                const promptText = `Digite a tarefa para ${td.dataset.time || "--"} (${dayNames[day]}):`;
                const task = prompt(promptText, currentTask);
                if (task !== null) {
                    selectedCells.forEach(cell => {
                        const contentDiv = cell.querySelector('.cell-content');
                        contentDiv.textContent = task;
                        let key = "";
                        if (cell.dataset.rowType === "default") {
                            key = `${cell.dataset.day}-${cell.dataset.time}`;
                        } else {
                            key = `${cell.dataset.day}-custom-${cell.dataset.id}-${cell.dataset.time}`;
                        }
                        scheduleData[key] = scheduleData[key] || {};
                        scheduleData[key].task = task;
                    });
                    saveScheduleData();
                }
            } else {
                selectedCells.forEach(cell => cell.classList.remove("selected"));
                selectedCells.clear();
                const currentTask = cellContent.textContent;
                const promptText = `Digite a tarefa para ${td.dataset.time || "--"} (${dayNames[day]}):`;
                const task = prompt(promptText, currentTask);
                if (task !== null) {
                    cellContent.textContent = task;
                    let key = "";
                    if (tdTime.dataset.rowType === "default") {
                        key = `${day}-${tdTime.dataset.time}`;
                    } else {
                        key = `${day}-custom-${tdTime.dataset.id}-${tdTime.dataset.time}`;
                    }
                    scheduleData[key] = scheduleData[key] || {};
                    scheduleData[key].task = task;
                    saveScheduleData();
                }
            }
        });

        td.dataset.rowType = tdTime.dataset.rowType;
        if (td.dataset.rowType === "custom") {
            td.dataset.id = tdTime.dataset.id;
        }
        tr.appendChild(td);
    }
    return tr;
}

/**
 * Renderiza todas as linhas (default e custom) na tabela, ordenando-as pelo horário.
 * Linhas sem horário definido ("") são posicionadas no topo.
 */
function renderRows() {
    tbody.innerHTML = "";
    const defaultRows = timeSlots.map((time, index) => {
        return { type: "default", index: index, time: time };
    });
    const combinedRows = defaultRows.concat(customRows);
    combinedRows.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    combinedRows.forEach(rowObj => {
        const row = createRow(rowObj);
        tbody.appendChild(row);
    });
}

// Renderiza a tabela inicialmente
renderRows();

// ----------------------
// EVENTOS GLOBAIS
// ----------------------

// Limpa seleção ao clicar fora da tabela
document.addEventListener('click', function (e) {
    if (!e.target.closest('#scheduleTable')) {
        selectedCells.forEach(cell => cell.classList.remove("selected"));
        selectedCells.clear();
    }
});

// Exclui linhas quando Backspace é pressionado e há seleção
document.addEventListener('keydown', function (e) {
    if (e.key === "Backspace" && selectedCells.size > 0) {
        e.preventDefault();
        selectedCells.forEach(cell => {
            const rowType = cell.dataset.rowType;
            const timeVal = cell.dataset.time;
            if (rowType === "default") {
                const idx = parseInt(cell.dataset.index, 10);
                for (let day = 0; day < 7; day++) {
                    const key = `${day}-${timeVal}`;
                    delete scheduleData[key];
                }
                timeSlots.splice(idx, 1);
                localStorage.setItem('timeSlots', JSON.stringify(timeSlots));
            } else if (rowType === "custom") {
                const rowId = cell.dataset.id;
                for (let day = 0; day < 7; day++) {
                    const key = `${day}-custom-${rowId}-${timeVal}`;
                    delete scheduleData[key];
                }
                customRows = customRows.filter(r => r.id !== rowId);
                saveCustomRows();
            }
        });
        saveScheduleData();
        selectedCells.clear();
        renderRows();
    }
});

// ----------------------
// BOTÃO DE ADICIONAR NOVA LINHA
// ----------------------
const addRowButton = document.getElementById('addRowButton');
if (addRowButton) {
    addRowButton.addEventListener('click', function () {
        // Cria nova linha custom sem horário definido
        const newCustomRow = { type: "custom", id: Date.now().toString(), time: "" };
        customRows.push(newCustomRow);
        saveCustomRows();
        renderRows();
    });
}

// Add reset table functionality
const resetTableButton = document.getElementById('resetTableButton');
if (resetTableButton) {
    resetTableButton.addEventListener('click', function () {
        const confirmReset = confirm('Tem certeza que deseja resetar toda a tabela? Todos os dados serão perdidos.');
        if (confirmReset) {
            // Reset localStorage items
            localStorage.removeItem('scheduleData');
            localStorage.removeItem('timeSlots');
            localStorage.removeItem('customRows');

            // Reset global variables
            scheduleData = {};
            timeSlots = [];
            customRows = [];

            // Regenera os horários padrão com intervalos de 1 hora
            for (let hour = startHour; hour <= endHour; hour++) {
                timeSlots.push(formatTime(hour, 0));
            }
            localStorage.setItem('timeSlots', JSON.stringify(timeSlots));

            // Rerenderiza a tabela
            renderRows();
        }
    });
}

// Abre o popup ao clicar no botão "Baixar Cronograma"
const downloadCronogramaButton = document.getElementById('downloadCronogramaButton');
const downloadPopup = document.getElementById('downloadPopup');
const closePopup = document.querySelector('.close-popup');

downloadCronogramaButton.addEventListener('click', function () {
    downloadPopup.style.display = 'block';
});

// Fecha o popup ao clicar no "X"
closePopup.addEventListener('click', function () {
    downloadPopup.style.display = 'none';
});

// Fecha o popup se clicar fora da área de conteúdo
window.addEventListener('click', function (e) {
    if (e.target === downloadPopup) {
        downloadPopup.style.display = 'none';
    }
});

// Função para baixar imagem PNG
document.getElementById('downloadImage').addEventListener('click', function () {
    const tableElement = document.getElementById('scheduleTable');
    html2canvas(tableElement).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = imgData;
        link.download = 'cronograma.png';
        link.click();
    });
    downloadPopup.style.display = 'none';
});

// Função para baixar PDF
document.getElementById('downloadPDF').addEventListener('click', function () {
    const tableElement = document.getElementById('scheduleTable');
    html2canvas(tableElement).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('landscape');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('cronograma.pdf');
    });
    downloadPopup.style.display = 'none';
});