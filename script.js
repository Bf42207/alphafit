// CONFIGURAÇÃO DO SEU FIREBASE (DADOS REAIS DO SEU PRINT)
const firebaseConfig = {
    apiKey: "AIzaSyBJE7MTjB-Kj-Mqm45I9q4MNGYj8RUeemo",
    authDomain: "alphafit-7f01c.firebaseapp.com",
    projectId: "alphafit-7f01c",
    storageBucket: "alphafit-7f01c.firebasestorage.app",
    messagingSenderId: "1080491601797",
    appId: "1:1080491601797:web:937c6f671f70a213c5deec",
    measurementId: "G-NXB28QLCHZ"
};

// Inicializando o Firebase no modo de compatibilidade para rodar direto no navegador
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Elementos da Tela de Login/Cadastro
const telaAuth = document.getElementById('tela-auth');
const conteudoApp = document.getElementById('conteudo-app');
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');

let usuarioLogadoAtualmente = null;
let exerciciosNoTreino = []; 
let rotinasSalvas = [];
let historicoTreinos = [];
let idEdicaoAtual = null; 

let timerInterval = null;
let totalSegundos = 0;
let nomeTreinoAtivoAtualmente = "";

// Elementos da Tela Principal
const campoIA = document.getElementById('campo-ia');
const caixaSugestoes = document.getElementById('caixa-sugestoes');
const treinoAtual = document.getElementById('treino-atual');
const nomeTreinoInput = document.getElementById('nome-treino');
const alerta = document.getElementById('alerta');
const numProntos = document.getElementById('num-prontos');

// Elementos da Janela Suspensa (Modal)
const modalHistorico = document.getElementById('modal-historico');
const modalTituloTreino = document.getElementById('modal-titulo-treino');
const modalListaExercicios = document.getElementById('modal-lista-exercicios');
const btnFecharModal = document.getElementById('btn-fechar-modal');

// Alternar Telas entre Login e Cadastro
document.getElementById('link-ir-cadastrar').addEventListener('click', (e) => {
    e.preventDefault(); formLogin.style.display = 'none'; formCadastro.style.display = 'block';
});
document.getElementById('link-ir-login').addEventListener('click', (e) => {
    e.preventDefault(); formCadastro.style.display = 'none'; formLogin.style.display = 'block';
});

// 🚀 CADASTRO REAL NA NUVEM DO FIREBASE
document.getElementById('btn-registrar').addEventListener('click', () => {
    const emailInput = document.getElementById('cad-usuario').value.trim();
    const senha = document.getElementById('cad-senha').value;
    const confirmaSenha = document.getElementById('cad-senha-confirma').value;

    if (!emailInput || !senha) { alert("Preencha todos os campos!"); return; }
    if (senha !== confirmaSenha) { alert("As senhas não coincidem!"); return; }
    
    const email = emailInput.includes('@') ? emailInput : `${emailInput}@alphafit.com`;

    auth.createUserWithEmailAndPassword(email, senha)
        .then((userCredential) => {
            alert("✅ Conta criada na Nuvem com sucesso!");
            formCadastro.style.display = 'none';
            formLogin.style.display = 'block';
        })
        .catch((error) => {
            if (error.code === 'auth/email-already-in-use') {
                alert("❌ Erro: Este usuário/e-mail já está cadastrado!");
            } else {
                alert("Erro ao cadastrar: " + error.message);
            }
        });
});

// 🔑 LOGIN REAL CONECTANDO À NUVEM
document.getElementById('btn-entrar').addEventListener('click', () => {
    const emailInput = document.getElementById('login-usuario').value.trim();
    const senha = document.getElementById('login-senha').value;

    if (!emailInput || !senha) { alert("Preencha os campos!"); return; }

    const email = emailInput.includes('@') ? emailInput : `${emailInput}@alphafit.com`;

    auth.signInWithEmailAndPassword(email, senha)
        .catch((error) => {
            alert("❌ Usuário ou senha incorretos!");
        });
});

// 🔄 MONITOR DE SESSÃO
auth.onAuthStateChanged((user) => {
    if (user) {
        usuarioLogadoAtualmente = user.uid;
        liberarAcessoApp();
    } else {
        usuarioLogadoAtualmente = null;
        telaAuth.style.display = 'flex';
        conteudoApp.style.display = 'none';
    }
});

function liberarAcessoApp() {
    telaAuth.style.display = 'none';
    conteudoApp.style.display = 'block';
    carregarDadosDaNuvem();
}

// ☁️ SALVAR E CARREGAR DADOS DO BANCO DE DADOS FIRESTORE
function carregarDadosDaNuvem() {
    if (!usuarioLogadoAtualmente) return;

    db.collection("usuarios").doc(usuarioLogadoAtualmente).get().then((doc) => {
        if (doc.exists) {
            const dados = doc.data();
            historicoTreinos = dados.historicoTreinos || [];
            rotinasSalvas = dados.rotinasSalvas || [];
        } else {
            historicoTreinos = [];
            rotinasSalvas = [];
        }
        renderizarTreinosProntos();
        renderizarHistorico();
        atualizarBadges();
    }).catch((error) => {
        console.error("Erro ao carregar dados: ", error);
    });
}

function salvarDadosNaNuvem() {
    if (!usuarioLogadoAtualmente) return;

    db.collection("usuarios").doc(usuarioLogadoAtualmente).set({
        historicoTreinos: historicoTreinos,
        rotinasSalvas: rotinasSalvas
    }, { merge: true });
}

// DICIONÁRIO DE BUSCA SIMPLES
const dicionarioFitness = [
    { termo: "rosca direta", opcoes: ["Rosca Direta com Barra W", "Rosca Direta com Halteres"] },
    { termo: "agachamento", opcoes: ["Agachamento Livre com Barra", "Agachamento Hack", "Agachamento Búlgaro"] },
    { termo: "perna", opcoes: ["Leg Press 45°", "Cadeira Extensora"] },
    { termo: "supino", opcoes: ["Supino Reto com Barra", "Supino Inclinado com Halteres"] },
    { termo: "peito", opcoes: ["Supino Reto com Barra", "Peck Deck (Voador)"] },
    { termo: "costas", opcoes: ["Puxada Alta na Polia", "Remada Baixa"] },
    { termo: "muay thai", opcoes: ["Treino de Saco: Soco + Chute", "Manopla de Velocidade"] }
];

// Evento para fechar a Janela Suspensa
btnFecharModal.addEventListener('click', () => {
    modalHistorico.classList.remove('ativo');
});
modalHistorico.addEventListener('click', (e) => {
    if (e.target === modalHistorico) modalHistorico.classList.remove('ativo');
});

// 🚪 LÓGICA DE SAIR DA CONTA (LOGOUT)
document.getElementById('btn-sair-usuario').addEventListener('click', () => {
    if (confirm("Deseja realmente sair da sua conta?")) {
        auth.signOut()
            .then(() => {
                // Limpa os dados da tela para o próximo não ver
                exerciciosNoTreino = [];
                rotinasSalvas = [];
                historicoTreinos = [];
                document.getElementById('treino-atual').innerHTML = "";
                document.getElementById('nome-treino').value = "";
                
                // Para o cronômetro se estiver rodando
                clearInterval(timerInterval);
                document.getElementById('timer-global').style.display = 'none';
                
                alert("Você saiu da sua conta com sucesso!");
            })
            .catch((error) => {
                alert("Erro ao sair: " + error.message);
            });
    }
});

// Navegação entre as abas superiores
document.getElementById('aba-montar-btn').addEventListener('click', () => mudarAba('montar'));
document.getElementById('aba-prontos-btn').addEventListener('click', () => mudarAba('prontos'));
document.getElementById('aba-historico-btn').addEventListener('click', () => { mudarAba('historico'); renderizarHistorico(); });

function mudarAba(aba) {
    document.getElementById('aba-montar-btn').classList.toggle('ativa', aba === 'montar');
    document.getElementById('aba-prontos-btn').classList.toggle('ativa', aba === 'prontos');
    document.getElementById('aba-historico-btn').classList.toggle('ativa', aba === 'historico');
    
    document.getElementById('secao-montar').style.display = aba === 'montar' ? 'block' : 'none';
    document.getElementById('secao-prontos').style.display = aba === 'prontos' ? 'block' : 'none';
    document.getElementById('secao-historico').style.display = aba === 'historico' ? 'block' : 'none';
    
    if (aba === 'prontos') renderizarTreinosProntos();
    if (aba === 'historico') renderizarHistorico();
    alerta.style.display = "none";
}

function atualizarBadges() {
    numProntos.innerText = rotinasSalvas.length;
}

// Caixa de Sugestões de Exercício
campoIA.addEventListener('input', () => {
    const texto = campoIA.value.toLowerCase().trim();
    caixaSugestoes.innerHTML = "";
    alerta.style.display = "none";

    if (texto.length === 0) { caixaSugestoes.style.display = "none"; return; }

    let achouAlgo = false;
    dicionarioFitness.forEach(item => {
        if (item.termo.includes(texto)) {
            item.opcoes.forEach(opcao => {
                achouAlgo = true;
                const divOpcao = document.createElement('div');
                divOpcao.className = 'sugestao-item';
                divOpcao.innerHTML = `<i class="fa-solid fa-dumbbell" style="color: var(--primary);"></i> ${opcao}`;
                
                divOpcao.addEventListener('click', () => {
                    if (exerciciosNoTreino.some(e => e.nome === opcao)) {
                        mostrarNotificacao("Esse exercício já está na lista!", "erro");
                        campoIA.value = "";
                        caixaSugestoes.style.display = "none";
                        return;
                    }
                    adicionarExercicioNaTela(opcao);
                    campoIA.value = "";
                    caixaSugestoes.style.display = "none";
                });
                caixaSugestoes.appendChild(divOpcao);
            });
        }
    });
    caixaSugestoes.style.display = achouAlgo ? "block" : "none";
});

function adicionarExercicioNaTela(nomeExercicio, dadosSeries = null) {
    const card = document.createElement('div');
    card.className = 'card-exercicio';
    card.dataset.nome = nomeExercicio;

    card.innerHTML = `
        <div class="card-top">
            <h4>${nomeExercicio}</h4>
            <button class="btn-remover"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <table class="tabela-series">
            <thead><tr><th>Série</th><th>KG</th><th>Reps</th><th><i class="fa-solid fa-check"></i></th></tr></thead>
            <tbody class="corpo-tabela-series"></tbody>
        </table>
        <button class="btn-add-set"><i class="fa-solid fa-plus"></i> Adicionar Série</button>
    `;

    card.querySelector('.btn-remover').addEventListener('click', () => {
        exerciciosNoTreino = exerciciosNoTreino.filter(e => e.nome !== nomeExercicio);
        card.remove();
    });

    const corpoTabela = card.querySelector('.corpo-tabela-series');
    
    function criarLinhaSerie(peso = "", reps = "") {
        const num = corpoTabela.children.length + 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="set-num">${num}</span></td>
            <td><input type="number" class="input-num kg-input" value="${peso}" placeholder="-"></td>
            <td><input type="number" class="input-num reps-input" value="${reps}" placeholder="-"></td>
            <td><button class="btn-check-set"><i class="fa-solid fa-check"></i></button></td>
        `;
        tr.querySelector('.btn-check-set').addEventListener('click', (e) => e.target.closest('.btn-check-set').classList.toggle('feito'));
        corpoTabela.appendChild(tr);
    }

    if (dadosSeries) {
        dadosSeries.forEach(s => criarLinhaSerie(s.peso, s.reps));
    } else {
        criarLinhaSerie(); criarLinhaSerie();
    }

    card.querySelector('.btn-add-set').addEventListener('click', () => criarLinhaSerie());
    treinoAtual.appendChild(card);
    exerciciosNoTreino.push({ nome: nomeExercicio, element: card });
}

// SALVAR ROTINA NA LISTA GERAL
document.getElementById('btn-salvar-rotina').addEventListener('click', () => {
    const nome = nomeTreinoInput.value.trim();
    if (!nome) { mostrarNotificacao("Dê um nome para o treino!", "erro"); return; }
    if (exerciciosNoTreino.length === 0) { mostrarNotificacao("Selecione pelo menos um exercício!", "erro"); return; }

    const exerciciosDados = [];

    treinoAtual.querySelectorAll('.card-exercicio').forEach(card => {
        const nomeEx = card.dataset.nome;
        const seriesDados = [];
        
        card.querySelectorAll('.corpo-tabela-series tr').forEach(tr => {
            seriesDados.push({
                peso: tr.querySelector('.kg-input').value,
                reps: tr.querySelector('.reps-input').value
            });
        });
        exerciciosDados.push({ nome: nomeEx, series: seriesDados });
    });

    const novaRotina = { nome, exercicios: exerciciosDados };

    if (idEdicaoAtual !== null) {
        rotinasSalvas[idEdicaoAtual] = novaRotina;
        idEdicaoAtual = null;
        document.getElementById('titulo-montar').innerText = "🛠️ Criar Nova Rotina";
        mostrarNotificacao(`Treino "${nome}" atualizado!`, "sucesso");
    } else {
        rotinasSalvas.push(novaRotina);
        mostrarNotificacao(`Treino "${nome}" guardado com sucesso!`, "sucesso");
    }

    salvarDadosNaNuvem();
    
    nomeTreinoInput.value = "";
    treinoAtual.innerHTML = "";
    exerciciosNoTreino = [];
    idEdicaoAtual = null;
    atualizarBadges();
});

// DESENHA OS TREINOS SALVOS
function renderizarTreinosProntos() {
    const lista = document.getElementById('lista-treinos-salvos');
    if (!lista) return;
    lista.innerHTML = "";
    atualizarBadges();

    if (rotinasSalvas.length === 0) {
        lista.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum treino criado ainda.</p>`;
        return;
    }

    rotinasSalvas.forEach((treino, indexOriginal) => {
        const div = document.createElement('div');
        div.className = 'card-treino-salvo';
        
        const listaExs = treino.exercicios.map(e => `• ${e.nome} (${e.series.length} séries)`).join('<br>');

        div.innerHTML = `
            <h3>${treino.nome}</h3>
            <p style="line-height: 1.6; color: #ddd; margin-top: 10px;">${listaExs}</p>
            <div class="botoes-treino-salvo">
                <button class="btn-ts btn-ts-iniciar"><i class="fa-solid fa-play"></i> Iniciar</button>
                <button class="btn-ts btn-ts-editar"><i class="fa-solid fa-pen"></i> Editar</button>
                <button class="btn-ts btn-ts-deletar"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        
        div.querySelector('.btn-ts-iniciar').addEventListener('click', () => iniciarSessaoTreino(indexOriginal));
        div.querySelector('.btn-ts-editar').addEventListener('click', () => carregarParaEdicao(indexOriginal));
        div.querySelector('.btn-ts-deletar').addEventListener('click', () => deletarRotina(indexOriginal));

        lista.appendChild(div);
    });
}

function carregarParaEdicao(index) {
    idEdicaoAtual = index;
    const rotina = rotinasSalvas[index];
    nomeTreinoInput.value = rotina.nome;
    treinoAtual.innerHTML = "";
    exerciciosNoTreino = [];
    document.getElementById('titulo-montar').innerText = `✏️ Editando: ${rotina.nome}`;
    rotina.exercicios.forEach(ex => adicionarExercicioNaTela(ex.nome, ex.series));
    mudarAba('montar');
}

function deletarRotina(index) {
    rotinasSalvas.splice(index, 1);
    salvarDadosNaNuvem();
    renderizarTreinosProntos();
}

function iniciarSessaoTreino(index) {
    const rotina = rotinasSalvas[index];
    carregarParaEdicao(index);
    idEdicaoAtual = null; 
    nomeTreinoAtivoAtualmente = rotina.nome;
    
    clearInterval(timerInterval);
    totalSegundos = 0;
    document.getElementById('timer-global').style.display = 'flex';
    
    timerInterval = setInterval(() => {
        totalSegundos++;
        const min = String(Math.floor(totalSegundos / 60)).padStart(2, '0');
        const seg = String(totalSegundos % 60).padStart(2, '0');
        document.getElementById('tempo-cronometro').innerText = `${min}:${seg}`;
    }, 1000);
    
    document.getElementById('titulo-montar').innerText = `🏋️‍♂️ Treinando: ${rotina.nome}`;
}

// ENCERRA O TREINO
document.getElementById('btn-encerrar').addEventListener('click', () => {
    let validacaoSucesso = true;
    alerta.style.display = "none";

    document.querySelectorAll('.input-num').forEach(i => i.classList.remove('erro-validacao'));

    const inputsKg = document.querySelectorAll('.kg-input');
    const inputsReps = document.querySelectorAll('.reps-input');

    inputsKg.forEach(input => {
        if(input.value.trim() === "") { input.classList.add('erro-validacao'); validacaoSucesso = false; }
    });
    inputsReps.forEach(input => {
        if(input.value.trim() === "") { input.classList.add('erro-validacao'); validacaoSucesso = false; }
    });

    if (!validacaoSucesso) {
        mostrarNotificacao("❌ Digite as cargas e repetições feitas antes de finalizar!", "erro");
        return;
    }

    const tempoFinal = document.getElementById('tempo-cronometro').innerText;
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    
    let volumeTotal = 0;
    const listaExerciciosExecutados = [];

    treinoAtual.querySelectorAll('.card-exercicio').forEach(card => {
        const nomeEx = card.dataset.nome;
        const totalSets = card.querySelectorAll('.corpo-tabela-series tr').length;
        
        card.querySelectorAll('.corpo-tabela-series tr').forEach(tr => {
            const kg = parseFloat(tr.querySelector('.kg-input').value) || 0;
            const reps = parseFloat(tr.querySelector('.reps-input').value) || 0;
            volumeTotal += (kg * reps);
        });

        listaExerciciosExecutados.push({
            nome: nomeEx,
            sets: totalSets
        });
    });

    historicoTreinos.unshift({
        id: Date.now(),
        nome: nomeTreinoAtivoAtualmente || "Treino Rápido",
        data: dataAtual,
        tempo: tempoFinal,
        volume: volumeTotal.toLocaleString('pt-BR') + " kg",
        exercicios: listaExerciciosExecutados
    });
    
    salvarDadosNaNuvem();

    clearInterval(timerInterval);
    document.getElementById('timer-global').style.display = 'none';
    
    nomeTreinoInput.value = "";
    treinoAtual.innerHTML = "";
    exerciciosNoTreino = [];
    idEdicaoAtual = null;
    mudarAba('historico');
});

// HISTÓRICO PRINCIPAL
function renderizarHistorico() {
    const container = document.getElementById('lista-historico');
    if (!container) return;
    container.innerHTML = "";

    if (historicoTreinos.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum treino feito ainda.</p>`;
        return;
    }

    const btnLimparTudo = document.createElement('button');
    btnLimparTudo.className = 'btn-limpar-tudo-hist';
    btnLimparTudo.innerHTML = `<i class="fa-solid fa-trash-can"></i> Limpar Todo o Histórico`;
    btnLimparTudo.addEventListener('click', limparTodoHistorico);
    container.appendChild(btnLimparTudo);

    historicoTreinos.forEach((h, indexOriginal) => {
        const div = document.createElement('div');
        div.className = 'card-historico';

        let htmlCard = `
            <div class="hist-header">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    <div>
                        <h3>${h.nome}</h3>
                        <span class="hist-date">Sessão • ${h.data}</span>
                    </div>
                    <button class="btn-deletar-hist" onclick="deletarItemHistorico(${indexOriginal})" title="Apagar este registro">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <div class="hist-stats">
                    <div>
                        <div class="stat-label">Tempo</div>
                        <div class="stat-val">${h.tempo}</div>
                    </div>
                    <div>
                        <div class="stat-label">Volume</div>
                        <div class="stat-val">${h.volume || "0 kg"}</div>
                    </div>
                </div>
            </div>
            <div class="hist-lista-exercicios">
        `;

        const limiteInicial = 3;
        const exerciciosExibidos = h.exercicios.slice(0, limiteInicial);
        
        exerciciosExibidos.forEach((ex) => {
            htmlCard += `
                <div class="hist-item-exercicio">
                    <span class="hist-icon-bullet">🔹</span>
                    <span class="hist-detalhe-sets"><strong>${ex.sets} sets</strong> ${ex.nome}</span>
                </div>
            `;
        });

        htmlCard += `</div>`;

        if (h.exercicios.length > limiteInicial) {
            const extras = h.exercicios.length - limiteInicial;
            htmlCard += `
                <button class="btn-ver-mais-hist" onclick="abrirCaixaSuspensa('${h.id}')">Veja ${extras} mais exercício${extras > 1 ? 's' : ''}</button>
            `;
        }

        div.innerHTML = htmlCard;
        container.appendChild(div);
    });
}

window.deletarItemHistorico = function(index) {
    if (confirm("Tem certeza que deseja apagar este registro de treino do histórico?")) {
        historicoTreinos.splice(index, 1);
        salvarDadosNaNuvem();
        renderizarHistorico();
    }
};

window.limparTodoHistorico = function() {
    if (confirm("⚠️ ATENÇÃO: Deseja APAGAR TODO o seu histórico de treinos?")) {
        historicoTreinos = [];
        salvarDadosNaNuvem();
        renderizarHistorico();
    }
};

window.abrirCaixaSuspensa = function(idTreino) {
    const treinoObj = historicoTreinos.find(h => String(h.id) === String(idTreino));
    if (!treinoObj) return;

    modalTituloTreino.innerText = treinoObj.nome;
    modalListaExercicios.innerHTML = "";

    treinoObj.exercicios.forEach(ex => {
        const item = document.createElement('div');
        item.className = 'hist-item-exercicio';
        item.innerHTML = `
            <span class="hist-icon-bullet">🔹</span>
            <span class="hist-detalhe-sets"><strong>${ex.sets} sets</strong> ${ex.nome}</span>
        `;
        modalListaExercicios.appendChild(item);
    });

    modalHistorico.classList.add('ativo');
};

document.getElementById('btn-comecar-direto').addEventListener('click', () => {
    if(exerciciosNoTreino.length === 0) { mostrarNotificacao("Adicione exercícios primeiro!", "erro"); return; }
    nomeTreinoAtivoAtualmente = nomeTreinoInput.value.trim() || "Treino Rápido";
    
    clearInterval(timerInterval);
    totalSegundos = 0;
    document.getElementById('timer-global').style.display = 'flex';
    timerInterval = setInterval(() => {
        totalSegundos++;
        const min = String(Math.floor(totalSegundos / 60)).padStart(2, '0');
        const seg = String(totalSegundos % 60).padStart(2, '0');
        document.getElementById('tempo-cronometro').innerText = `${min}:${seg}`;
    }, 1000);
    document.getElementById('titulo-montar').innerText = `🏋️‍♂️ Sessão Iniciada!`;
});

function mostrarNotificacao(txt, tipo) { 
    alerta.innerText = txt; 
    alerta.className = `alerta ${tipo}`;
    alerta.style.display = "block"; 
    window.scrollTo(0,0); 
}

document.addEventListener('click', (e) => { if (e.target !== campoIA) caixaSugestoes.style.display = "none"; });