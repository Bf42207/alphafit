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

// Mapeamento dos Elementos do DOM
const telaAuth = document.getElementById('tela-auth');
const conteudoApp = document.getElementById('conteudo-app');
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');

const campoIA = document.getElementById('campo-ia');
const caixaSugestoes = document.getElementById('caixa-sugestoes');
const treinoAtual = document.getElementById('treino-atual');
const nomeTreinoInput = document.getElementById('nome-treino');
const numProntos = document.getElementById('num-prontos');

// Variáveis de Estado Global
let usuarioLogadoAtualmente = null;
let nomeUsuarioLogado = "Atleta Alpha";
let exerciciosNoTreino = []; 
let rotinasSalvas = [];
let historicoTreinos = [];
let historicoPesos = [];

let timerInterval = null;
let totalSegundos = 0;
let nomeTreinoAtivoAtualmente = "";
let dataAtualCalendario = new Date();

// Monitor de Login do Firebase
auth.onAuthStateChanged((user) => {
    if (user) {
        usuarioLogadoAtualmente = user.uid;
        nomeUsuarioLogado = user.email.split('@')[0];
        document.getElementById('nome-perfil-usuario').innerText = "💪 " + nomeUsuarioLogado;
        
        telaAuth.style.display = 'none';
        conteudoApp.style.display = 'flex';
        
        carregarDadosDoUsuario();
        escutarFeedSocial();
    } else {
        usuarioLogadoAtualmente = null;
        telaAuth.style.display = 'flex';
        conteudoApp.style.display = 'none';
    }
});

function carregarDadosDoUsuario() {
    if (!usuarioLogadoAtualmente) return;
    db.collection("usuarios").doc(usuarioLogadoAtualmente).get().then((doc) => {
        if (doc.exists) {
            const dados = doc.data();
            historicoTreinos = dados.historicoTreinos || [];
            rotinasSalvas = dados.rotinasSalvas || [];
            historicoPesos = dados.historicoPesos || [];
        }
        atualizarInterfacePerfil();
        renderizarTreinosProntos();
        renderizarHistorico();
        renderizarCalendario();
    });
}

function salvarDadosUsuario() {
    if (!usuarioLogadoAtualmente) return;
    db.collection("usuarios").doc(usuarioLogadoAtualmente).set({
        historicoTreinos: historicoTreinos,
        rotinasSalvas: rotinasSalvas,
        historicoPesos: historicoPesos,
        nomeUsuario: nomeUsuarioLogado
    }, { merge: true });
}

// TROCA DE ABAS NATIVA DO MENU LATERAL
const abas = ['feed', 'montar', 'prontos', 'historico', 'perfil'];
abas.forEach(aba => {
    document.getElementById(`aba-${aba}-btn`).addEventListener('click', () => mudarAba(aba));
});

function mudarAba(abaAlvo) {
    abas.forEach(aba => {
        const btn = document.getElementById(`aba-${aba}-btn`);
        const secao = document.getElementById(`secao-${aba}`);
        if(aba === abaAlvo) {
            btn.classList.add('ativa');
            secao.style.display = 'block';
        } else {
            btn.classList.remove('ativa');
            secao.style.display = 'none';
        }
    });
    if(abaAlvo === 'perfil') {
        renderizarCalendario();
        renderizarHistoricoPesos();
    }
}

// SISTEMA DE PESO DO PERFIL
function atualizarInterfacePerfil() {
    numProntos.innerText = rotinasSalvas.length;
    document.getElementById('total-dias-treinados').innerText = `${historicoTreinos.length} dias`;
    document.getElementById('peso-atual-texto').innerText = historicoPesos.length > 0 ? `${historicoPesos[0].peso} kg` : "-- kg";
}

document.getElementById('btn-registrar-peso').addEventListener('click', () => {
    const inputPeso = document.getElementById('input-novo-peso');
    const valor = parseFloat(inputPeso.value);
    if (!valor || valor <= 0) return;

    historicoPesos.unshift({
        id: Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        peso: valor
    });
    inputPeso.value = "";
    salvarDadosUsuario();
    atualizarInterfacePerfil();
    renderizarHistoricoPesos();
});

function renderizarHistoricoPesos() {
    const container = document.getElementById('historico-pesos');
    container.innerHTML = "";
    if(historicoPesos.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); font-size:14px;">Nenhum peso registrado.</p>`;
        return;
    }
    historicoPesos.slice(0, 5).forEach(p => {
        const item = document.createElement('div');
        item.style = "display:flex; justify-content:space-between; padding:8px; background:#121212; border-radius:6px; font-size:14px; border:1px solid #2c2c2c;";
        item.innerHTML = `<span>📅 ${p.data}</span> <strong>${p.peso} kg</strong>`;
        container.appendChild(item);
    });
}

// CALENDÁRIO DINÂMICO DE TREINOS
function renderizarCalendario() {
    const grid = document.getElementById('dias-calendario-grid');
    const txtMesAno = document.getElementById('mes-ano-calendario');
    grid.innerHTML = "";
    
    const ano = dataAtualCalendario.getFullYear();
    const mes = dataAtualCalendario.getMonth();
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    txtMesAno.innerText = `${meses[mes]} ${ano}`;
    
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    
    const diasTreinados = historicoTreinos.filter(t => {
        const partes = t.data.split('/');
        return parseInt(partes[1]) === (mes + 1) && parseInt(partes[2]) === ano;
    }).map(t => parseInt(t.data.split('/')[0]));

    for (let i = 0; i < primeiroDia; i++) {
        grid.appendChild(document.createElement('div'));
    }
    
    for (let dia = 1; dia <= totalDias; dia++) {
        const celula = document.createElement('div');
        celula.className = "dia-celula";
        celula.innerText = dia;
        if (diasTreinados.includes(dia)) {
            celula.classList.add('treinado');
        }
        grid.appendChild(celula);
    }
}

document.getElementById('btn-prev-mes').addEventListener('click', () => { dataAtualCalendario.setMonth(dataAtualCalendario.getMonth() - 1); renderizarCalendario(); });
document.getElementById('btn-next-mes').addEventListener('click', () => { dataAtualCalendario.setMonth(dataAtualCalendario.getMonth() + 1); renderizarCalendario(); });

// REDE SOCIAL (FEED)
document.getElementById('btn-abrir-postar').addEventListener('click', () => {
    const caixa = document.getElementById('caixa-criar-post');
    caixa.style.display = caixa.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('btn-publicar-post').addEventListener('click', () => {
    const texto = document.getElementById('texto-post').value.trim();
    const urlFoto = document.getElementById('url-foto-post').value.trim();
    if(!texto) return;

    db.collection("feed").add({
        uid: usuarioLogadoAtualmente,
        usuario: nomeUsuarioLogado,
        texto: texto,
        foto: urlFoto || null,
        dataHora: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        document.getElementById('texto-post').value = "";
        document.getElementById('url-foto-post').value = "";
        document.getElementById('caixa-criar-post').style.display = 'none';
    });
});

function escutarFeedSocial() {
    db.collection("feed").orderBy("dataHora", "desc").limit(15).onSnapshot((snapshot) => {
        const container = document.getElementById('lista-feed');
        container.innerHTML = "";
        if (snapshot.empty) {
            container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:30px;">Nenhuma publicação ainda. Seja o primeiro!</p>`;
            return;
        }
        snapshot.forEach((doc) => {
            const post = doc.data();
            const card = document.createElement('div');
            card.className = "card-exercicio";
            card.style.padding = "15px";
            card.style.marginBottom = "15px";
            
            let htmlFoto = post.foto ? `<img src="${post.foto}" style="width:100%; border-radius:8px; margin-top:10px; max-height:350px; object-fit:cover;" onerror="this.style.display='none'">` : "";
            card.innerHTML = `<div style="font-weight:bold; color:var(--primary); margin-bottom:8px;">🟢 @${post.usuario}</div><p>${post.texto}</p>${htmlFoto}`;
            container.appendChild(card);
        });
    });
}

// DICIONÁRIO DE EXERCÍCIOS E ENGINE DE TREINOS
const dicionarioFitness = [
    { termo: "rosca direta", opcoes: ["Rosca Directa com Barra W", "Rosca Directa com Halteres"] },
    { termo: "agachamento", opcoes: ["Agachamento Livre", "Agachamento Hack", "Agachamento Búlgaro"] },
    { termo: "supino", opcoes: ["Supino Reto com Barra", "Supino Inclinado com Halteres"] },
    { termo: "peito", opcoes: ["Supino Reto com Barra", "Peck Deck / Voador"] },
    { termo: "costas", opcoes: ["Puxada Alta", "Remada Baixa"] },
    { termo: "perna", opcoes: ["Leg Press 45°", "Cadeira Extensora"] }
];

campoIA.addEventListener('input', () => {
    const texto = campoIA.value.toLowerCase().trim();
    caixaSugestoes.innerHTML = "";
    if (texto.length === 0) { caixaSugestoes.style.display = "none"; return; }
    let achou = false;
    dicionarioFitness.forEach(item => {
        if (item.termo.includes(texto)) {
            item.opcoes.forEach(opcao => {
                achou = true;
                const div = document.createElement('div');
                div.className = 'sugestao-item';
                div.style = "padding:10px; cursor:pointer; border-bottom:1px solid #222;";
                div.innerHTML = `<i class="fa-solid fa-dumbbell" style="color:var(--primary); margin-right:8px;"></i> ${opcao}`;
                div.addEventListener('click', () => {
                    if (exerciciosNoTreino.some(e => e.nome === opcao)) return;
                    adicionarExercicioNaTela(opcao);
                    campoIA.value = "";
                    caixaSugestoes.style.display = "none";
                });
                caixaSugestoes.appendChild(div);
            });
        }
    });
    caixaSugestoes.style.display = achou ? "block" : "none";
});

function adicionarExercicioNaTela(nomeExercicio, dadosSeries = null) {
    const card = document.createElement('div');
    card.className = 'card-exercicio';
    card.dataset.nome = nomeExercicio;
    card.innerHTML = `
        <div class="card-top"><h4>${nomeExercicio}</h4><button class="btn-remover"><i class="fa-solid fa-xmark"></i></button></div>
        <table class="tabela-series">
            <thead><tr><th>Série</th><th>KG</th><th>Reps</th><th><i class="fa-solid fa-check"></i></th></tr></thead>
            <tbody class="corpo-tabela-series"></tbody>
        </table>
        <button class="btn-add-set" style="background:#222; color:#fff; border:none; padding:5px 10px; border-radius:5px; margin-top:5px; cursor:pointer;"><i class="fa-solid fa-plus"></i> Adicionar Série</button>
    `;
    card.querySelector('.btn-remover').addEventListener('click', () => {
        exerciciosNoTreino = exerciciosNoTreino.filter(e => e.nome !== nomeExercicio);
        card.remove();
    });
    const corpo = card.querySelector('.corpo-tabela-series');
    function criarLinha(p="", r="") {
        const num = corpo.children.length + 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><span>${num}</span></td>
            <td><input type="number" class="input-num kg-input" value="${p}" style="width:50px; background:#121212; border:1px solid #333; color:#fff; text-align:center;"></td>
            <td><input type="number" class="input-num reps-input" value="${r}" style="width:50px; background:#121212; border:1px solid #333; color:#fff; text-align:center;"></td>
            <td><button class="btn-check-set" style="background:none; border:none; color:var(--text-muted); cursor:pointer;"><i class="fa-solid fa-check"></i></button></td>`;
        tr.querySelector('.btn-check-set').addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-check-set');
            btn.classList.toggle('feito');
            btn.style.color = btn.classList.contains('feito') ? 'var(--primary)' : 'var(--text-muted)';
        });
        corpo.appendChild(tr);
    }
    if (dadosSeries) dadosSeries.forEach(s => criarLinha(s.peso, s.reps));
    else { criarLinha(); criarLinha(); }
    card.querySelector('.btn-add-set').addEventListener('click', () => criarLinha());
    treinoAtual.appendChild(card);
    exerciciosNoTreino.push({ nome: nomeExercicio, element: card });
}

document.getElementById('btn-salvar-rotina').addEventListener('click', () => {
    const nome = nomeTreinoInput.value.trim();
    if (!nome || exerciciosNoTreino.length === 0) return;
    const exs = [];
    treinoAtual.querySelectorAll('.card-exercicio').forEach(card => {
        const sers = [];
        card.querySelectorAll('.corpo-tabela-series tr').forEach(tr => {
            sers.push({ peso: tr.querySelector('.kg-input').value, reps: tr.querySelector('.reps-input').value });
        });
        exs.push({ nome: card.dataset.nome, series: sers });
    });
    rotinasSalvas.push({ nome, exercicios: exs });
    salvarDadosUsuario();
    nomeTreinoInput.value = "";
    treinoAtual.innerHTML = "";
    exerciciosNoTreino = [];
    atualizarInterfacePerfil();
    renderizarTreinosProntos();
    alert("Treino salvo!");
});

function renderizarTreinosProntos() {
    const lista = document.getElementById('lista-treinos-salvos');
    lista.innerHTML = "";
    if (rotinasSalvas.length === 0) return;
    rotinasSalvas.forEach((treino, index) => {
        const div = document.createElement('div');
        div.className = 'card-exercicio';
        div.style.padding = "15px";
        const exs = treino.exercicios.map(e => `• ${e.nome}`).join('<br>');
        div.innerHTML = `<h3>${treino.nome}</h3><p style="margin:8px 0; color:#aaa; font-size:14px;">${exs}</p>
            <button onclick="iniciarSessaoTreino(${index})" style="background:var(--primary); border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold; color:#000;">Iniciar Treino</button>`;
        lista.appendChild(div);
    });
}

function iniciarSessaoTreino(index) {
    const rotina = rotinasSalvas[index];
    nomeTreinoInput.value = rotina.nome;
    treinoAtual.innerHTML = "";
    exerciciosNoTreino = [];
    rotina.exercicios.forEach(ex => adicionarExercicioNaTela(ex.nome, ex.series));
    nomeTreinoAtivoAtualmente = rotina.nome;
    mudarAba('montar');
    
    clearInterval(timerInterval);
    totalSegundos = 0;
    document.getElementById('timer-global').style.display = 'flex';
    timerInterval = setInterval(() => {
        totalSegundos++;
        document.getElementById('tempo-cronometro').innerText = `${String(Math.floor(totalSegundos / 60)).padStart(2, '0')}:${String(totalSegundos % 60).padStart(2, '0')}`;
    }, 1000);
}

document.getElementById('btn-comecar-direto').addEventListener('click', () => {
    if(exerciciosNoTreino.length === 0) return;
    nomeTreinoAtivoAtualmente = nomeTreinoInput.value.trim() || "Treino Rápido";
    document.getElementById('timer-global').style.display = 'flex';
    clearInterval(timerInterval);
    totalSegundos = 0;
    timerInterval = setInterval(() => {
        totalSegundos++;
        document.getElementById('tempo-cronometro').innerText = `${String(Math.floor(totalSegundos / 60)).padStart(2, '0')}:${String(totalSegundos % 60).padStart(2, '0')}`;
    }, 1000);
});

document.getElementById('btn-encerrar').addEventListener('click', () => {
    const tempoFinal = document.getElementById('tempo-cronometro').innerText;
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    let volume = 0;
    const exs = [];

    treinoAtual.querySelectorAll('.card-exercicio').forEach(card => {
        card.querySelectorAll('.corpo-tabela-series tr').forEach(tr => {
            volume += (parseFloat(tr.querySelector('.kg-input').value)||0) * (parseFloat(tr.querySelector('.reps-input').value)||0);
        });
        exs.push({ nome: card.dataset.nome, sets: card.querySelectorAll('.corpo-tabela-series tr').length });
    });

    historicoTreinos.unshift({ id: Date.now(), nome: nomeTreinoAtivoAtualmente, data: dataAtual, tempo: tempoFinal, volume: volume + " kg", exercicios: exs });
    salvarDadosUsuario();
    
    clearInterval(timerInterval);
    document.getElementById('timer-global').style.display = 'none';
    nomeTreinoInput.value = "";
    treinoAtual.innerHTML = "";
    exerciciosNoTreino = [];
    mudarAba('historico');
});

function renderizarHistorico() {
    const container = document.getElementById('lista-historico');
    container.innerHTML = "";
    if (historicoTreinos.length === 0) return;
    historicoTreinos.forEach(h => {
        const div = document.createElement('div');
        div.className = 'card-exercicio';
        div.style.padding = "15px";
        let htmlExs = h.exercicios.map(e => `🔹 ${e.sets} séries de ${e.nome}`).join('<br>');
        div.innerHTML = `<h3>${h.nome}</h3><p style="font-size:13px; color:var(--primary); margin:5px 0;">📅 ${h.data} • ⏱️ ${h.tempo} • 🏋️ Vol: ${h.volume}</p><p style="font-size:14px; color:#ddd;">${htmlExs}</p>`;
        container.appendChild(div);
    });
}

// Lógica das Telas de Autenticação
document.getElementById('link-ir-cadastrar').addEventListener('click', (e) => { e.preventDefault(); formLogin.style.display = 'none'; formCadastro.style.display = 'block'; });
document.getElementById('link-ir-login').addEventListener('click', (e) => { e.preventDefault(); formCadastro.style.display = 'none'; formLogin.style.display = 'block'; });
document.getElementById('btn-registrar').addEventListener('click', () => {
    const u = document.getElementById('cad-usuario').value.trim();
    const s = document.getElementById('cad-senha').value;
    auth.createUserWithEmailAndPassword(`${u}@alphafit.com`, s).catch(e => alert(e.message));
});
document.getElementById('btn-entrar').addEventListener('click', () => {
    const u = document.getElementById('login-usuario').value.trim();
    const s = document.getElementById('login-senha').value;
    auth.signInWithEmailAndPassword(u.includes('@') ? u : `${u}@alphafit.com`, s).catch(() => alert("Erro!"));
});
document.getElementById('btn-sair-usuario').addEventListener('click', () => { auth.signOut().then(() => location.reload()); });
