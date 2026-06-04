// CONFIGURAÇÃO DO SEU FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyBJE7MTjB-Kj-Mqm45I9q4MNGYj8RUeemo",
    authDomain: "alphafit-7f01c.firebaseapp.com",
    projectId: "alphafit-7f01c",
    storageBucket: "alphafit-7f01c.firebasestorage.app",
    messagingSenderId: "1080491601797",
    appId: "1:1080491601797:web:937c6f671f70a213c5deec",
    measurementId: "G-NXB28QLCHZ"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

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

const campoIA = document.getElementById('campo-ia');
const caixaSugestoes = document.getElementById('caixa-sugestoes');
const treinoAtual = document.getElementById('treino-atual');
const nomeTreinoInput = document.getElementById('nome-treino');
const alerta = document.getElementById('alerta');
const numProntos = document.getElementById('num-prontos');

const modalHistorico = document.getElementById('modal-historico');
const modalTituloTreino = document.getElementById('modal-titulo-treino');
const modalListaExercicios = document.getElementById('modal-lista-exercicios');
const btnFecharModal = document.getElementById('btn-fechar-modal');

// --- SISTEMA DE ACESSO OFFLINE INTEGRADO ---

// 1. Tenta carregar dados locais imediatamente para o app funcionar mesmo sem rede
carregarDadosLocais();

// Monitor de sessão do Firebase
auth.onAuthStateChanged((user) => {
    if (user) {
        usuarioLogadoAtualmente = user.uid;
        localStorage.setItem('alphafit_ultimo_usuario', user.uid); // Lembra quem logou
        liberarAcessoApp();
    } else {
        // Se não há internet e já existia um usuário logado antes, pula a tela de login!
        const ultimoUsuario = localStorage.getItem('alphafit_ultimo_usuario');
        if (ultimoUsuario) {
            usuarioLogadoAtualmente = ultimoUsuario;
            liberarAcessoApp();
        } else {
            usuarioLogadoAtualmente = null;
            telaAuth.style.display = 'flex';
            conteudoApp.style.display = 'none';
        }
    }
});

function liberarAcessoApp() {
    telaAuth.style.display = 'none';
    conteudoApp.style.display = 'block';
    
    // Renderiza o que já tem gravado no celular imediatamente
    renderizarTreinosProntos();
    renderizarHistorico();
    atualizarBadges();

    // Se tiver internet, busca atualizações mais novas da nuvem de fundo
    if (navigator.onLine) {
        carregarDadosDaNuvem();
    }
}

// Carrega o banco de dados do celular
function carregarDadosLocais() {
    const rotinasLocais = localStorage.getItem('alphafit_rotinas');
    const historicoLocal = localStorage.getItem('alphafit_historico');
    
    if (rotinasLocais) rotinasSalvas = JSON.parse(rotinasLocais);
    if (historicoLocal) historicoTreinos = JSON.parse(historicoLocal);
}

// Salva localmente e tenta enviar para nuvem
function salvarDadosGerais() {
    // Guarda na memória física do celular na mesma hora (Funciona offline!)
    localStorage.setItem('alphafit_rotinas', JSON.stringify(rotinasSalvas));
    localStorage.setItem('alphafit_historico', JSON.stringify(historicoTreinos));

    // Se o celular estiver conectado à internet, atualiza o backup na nuvem
    if (navigator.onLine && usuarioLogadoAtualmente) {
        db.collection("usuarios").doc(usuarioLogadoAtualmente).set({
            historicoTreinos: historicoTreinos,
            rotinasSalvas: rotinasSalvas
        }, { merge: true }).catch(err => console.log("Aguardando rede para sincronizar nuvem..."));
    }
}

function carregarDadosDaNuvem() {
    if (!usuarioLogadoAtualmente) return;

    db.collection("usuarios").doc(usuarioLogadoAtualmente).get().then((doc) => {
        if (doc.exists) {
            const dados = doc.data();
            // Só substitui se o da nuvem tiver dados reais para não zerar o offline
            if (dados.rotinasSalvas || dados.historicoTreinos) {
                historicoTreinos = dados.historicoTreinos || [];
                rotinasSalvas = dados.rotinasSalvas || [];
                
                // Atualiza o armazenamento do celular com o backup da nuvem
                localStorage.setItem('alphafit_rotinas', JSON.stringify(rotinasSalvas));
                localStorage.setItem('alphafit_historico', JSON.stringify(historicoTreinos));
                
                renderizarTreinosProntos();
                renderizarHistorico();
                atualizarBadges();
            }
        }
    }).catch((error) => {
        console.log("Rodando em modo Offline local.");
    });
}

// --- LOGOUT / SAIR (Limpa o celular e a nuvem) ---
document.getElementById('btn-sair-usuario').addEventListener('click', () => {
    if (confirm("Deseja realmente sair da sua conta?")) {
        // Limpa as senhas guardadas no aparelho
        localStorage.removeItem('alphafit_ultimo_usuario');
        localStorage.removeItem('alphafit_rotinas');
        localStorage.removeItem('alphafit_historico');
        
        auth.signOut().then(() => {
            exerciciosNoTreino = [];
            rotinasSalvas = [];
            historicoTreinos = [];
            document.getElementById('treino-atual').innerHTML = "";
            document.getElementById('nome-treino').value = "";
            clearInterval(timerInterval);
            document.getElementById('timer-global').style.display = 'none';
            location.reload(); // Recarrega para voltar para a tela de login limpa
        }).catch(() => {
            // Se estiver sem internet, força a volta para tela de login mesmo assim
            location.reload();
        });
    }
});

// --- LÓGICA DAS ABAS E INTERAÇÃO DA TELA ---
document.getElementById('link-ir-cadastrar').addEventListener('click', (e) => {
    e.preventDefault(); formLogin.style.display = 'none'; formCadastro.style.display = 'block';
});
document.getElementById('link-ir-login').addEventListener('click', (e) => {
    e.preventDefault(); formCadastro.style.display = 'none'; formLogin.style.display = 'block';
});

document.getElementById('btn-registrar').addEventListener('click', () => {
    const emailInput = document.getElementById('cad-usuario').value.trim();
    const senha = document.getElementById('cad-senha').value;
    const confirmaSenha = document.getElementById('cad-senha-confirma').value;

    if (!emailInput || !senha) { alert("Preencha todos os campos!"); return; }
    if (senha !== confirmaSenha) { alert("As senhas não coincidem!"); return; }
    
    const email = emailInput.includes('@') ? emailInput : `${emailInput}@alphafit.com`;

    auth.createUserWithEmailAndPassword(email, senha)
        .then(() => {
            alert("✅ Conta criada com sucesso!");
            formCadastro.style.display = 'none';
            formLogin.style.display = 'block';
        })
        .catch((error) => {
            alert("Erro ao cadastrar: " + error.message);
        });
});

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

const dicionarioFitness = [
    { termo: "rosca direta", opcoes: ["Rosca Direta com Barra W", "Rosca Direta com Halteres"] },
    { termo: "agachamento", opcoes: ["Agachamento Livre com Barra", "Agachamento Hack", "Agachamento Búlgaro"] },
    { termo: "perna", opcoes: ["Leg Press 45°", "Cadeira Extensora"] },
    { termo: "supino", opcoes: ["Supino Reto com Barra", "Supino Inclinado com Halteres"] },
    { termo: "peito", opcoes: ["Supino Reto com Barra", "Peck Deck (Voador)"] },
    { termo: "costas", opcoes: ["Puxada Alta na Polia", "Remada Baixa"] },
    { termo: "muay thai", opcoes: ["Treino de Saco: Soco + Chute", "Manopla de Velocidade"] }
];

btnFecharModal.addEventListener('click', () => modalHistorico.classList.remove('ativo'));

document.getElementById('aba-montar-btn').addEventListener('click', () => mudarAba('montar'));
document.getElementById('aba-prontos-btn').addEventListener('click', () => mudarAba('prontos'));
document.getElementById('aba-historico-btn').addEventListener('click', () => mudarAba('historico'));

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

function atualizarBadges() { numProntos.innerText = rotinasSalvas.length; }

campoIA.addEventListener('input', () => {
    const texto = campoIA.value.toLowerCase().trim();
    caixaSugestoes.innerHTML = "";

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
                    if (exerciciosNoTreino.some(e => e.nome === opcao)) { alert("Esse exercício já está na lista!"); return; }
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

document.getElementById('btn-salvar-rotina').addEventListener('click', () => {
    const nome = nomeTreinoInput.value.trim();
    if (!nome) { alert("Dê um nome para o treino!"); return; }
    if (exerciciosNoTreino.length === 0) { alert("Selecione pelo menos um exercício!"); return; }

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
    } else {
        rotinasSalvas.push(novaRotina);
    }

    salvarDadosGerais(); // Salva no celular e sincroniza!
    nomeTreinoInput.value = "";
    treinoAtual.innerHTML = "";
    exerciciosNoTreino = [];
    atualizarBadges();
    alert("Treino guardado com sucesso!");
});

function renderizarTreinosProntos() {
    const lista = document.getElementById('lista-treinos-salvos');
    if (!lista) return;
    lista.innerHTML = "";

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
        div.querySelector('.btn-ts-deletar').addEventListener('click', () => {
            if(confirm("Excluir esse treino?")) {
                rotinasSalvas.splice(indexOriginal, 1);
                salvarDadosGerais();
                renderizarTreinosProntos();
                atualizarBadges();
            }
        });
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
}

document.getElementById('btn-encerrar').addEventListener('click', () => {
    let validacaoSucesso = true;
    document.querySelectorAll('.input-num').forEach(i => i.classList.remove('erro-validacao'));

    document.querySelectorAll('.kg-input, .reps-input').forEach(input => {
        if(input.value.trim() === "") { input.classList.add('erro-validacao'); validacaoSucesso = false; }
    });

    if (!validacaoSucesso) { alert("Digite as cargas e repetições feitas!"); return; }

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
        listaExerciciosExecutados.push({ nome: nomeEx, sets: totalSets });
    });

    historicoTreinos.unshift({
        id: Date.now(),
        nome: nomeTreinoAtivoAtualmente || "Treino Rápido",
        data: dataAtual,
        tempo: tempoFinal,
        volume: volumeTotal.toLocaleString('pt-BR') + " kg",
        exercicios: listaExerciciosExecutados
    });
    
    salvarDadosGerais(); // Grava o treino finalizado localmente!
    clearInterval(timerInterval);
    document.getElementById('timer-global').style.display = 'none';
    nomeTreinoInput.value = "";
    treinoAtual.innerHTML = "";
    exerciciosNoTreino = [];
    document.getElementById('titulo-montar').innerText = "🛠️ Criar Nova Rotina";
    mudarAba('historico');
});

function renderizarHistorico() {
    const container = document.getElementById('lista-historico');
    if (!container) return;
    container.innerHTML = "";

    if (historicoTreinos.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum treino feito ainda.</p>`;
        return;
    }

    historicoTreinos.forEach((h) => {
        const div = document.createElement('div');
        div.className = 'card-historico';
        let htmlCard = `<h3>${h.nome}</h3><p class="hist-date">${h.data} • ⏱️ ${h.tempo} • 🏋️‍♂️ Vol: ${h.volume}</p><div class="hist-lista-exercicios">`;
        h.exercicios.forEach(ex => {
            htmlCard += `<div class="hist-item-exercicio">🔹 ${ex.sets} sets de ${ex.nome}</div>`;
        });
        htmlCard += `</div>`;
        div.innerHTML = htmlCard;
        container.appendChild(div);
    });
}

document.getElementById('btn-comecar-direto').addEventListener('click', () => {
    if(exerciciosNoTreino.length === 0) { alert("Adicione exercícios primeiro!"); return; }
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
});
