// ==========================================================================
// 1. CONFIGURAÇÃO DO FIREBASE & ESTADO GLOBAL
// ==========================================================================
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

// Elementos Domésticos / Interface
const telaAuth = document.getElementById('tela-auth');
const conteudoApp = document.getElementById('conteudo-app');
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');

// Variáveis de Estado
let usuarioLogadoAtualmente = null;
let nomeUsuarioLogado = "Atleta Alpha";
let perfilPublico = true;
let exerciciosNoTreino = []; 
let rotinasSalvas = [];
let historicoTreinos = [];
let historicoPesos = [];

let idEdicaoAtual = null; 
let timerInterval = null;
let totalSegundos = 0;
let nomeTreinoAtivoAtualmente = "";

// Elementos de Controlo das Abas
const campoIA = document.getElementById('campo-ia');
const caixaSugestoes = document.getElementById('caixa-sugestoes');
const treinoAtual = document.getElementById('treino-atual');
const nomeTreinoInput = document.getElementById('nome-treino');
const numProntos = document.getElementById('num-prontos');

// Estado do Calendário
let dataAtualCalendario = new Date();

// ==========================================================================
// 2. CONTROLO DE SESSÃO & SINCRONIZAÇÃO (FIREBASE)
// ==========================================================================
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
            perfilPublico = dados.perfilPublico !== undefined ? dados.perfilPublico : true;
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
        perfilPublico: perfilPublico,
        nomeUsuario: nomeUsuarioLogado
    }, { merge: true });
}

// ==========================================================================
// 3. NAVEGAÇÃO ENTRE ABAS (ESTILO INSTAGRAM)
// ==========================================================================
const abasIds = ['feed', 'montar', 'prontos', 'historico', 'perfil'];
abasIds.forEach(aba => {
    document.getElementById(`aba-${aba}-btn`).addEventListener('click', () => mudarAba(aba));
});

function mudarAba(abaAlvo) {
    abasIds.forEach(aba => {
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

// ==========================================================================
// 4. FUNCIONALIDADE DO PERFIL, EVOLUÇÃO DE PESO E CALENDÁRIO
// ==========================================================================
function atualizarInterfacePerfil() {
    numProntos.innerText = rotinasSalvas.length;
    document.getElementById('total-dias-treinados').innerText = `${historicoTreinos.length} dias`;
    
    if (historicoPesos.length > 0) {
        document.getElementById('peso-atual-texto').innerText = `${historicoPesos[0].peso} kg`;
    } else {
        document.getElementById('peso-atual-texto').innerText = "-- kg";
    }
    
    document.getElementById('status-visibilidade').innerText = perfilPublico ? "Público 🌐" : "Privado 🔒";
}

document.getElementById('btn-registrar-peso').addEventListener('click', () => {
    const inputPeso = document.getElementById('input-novo-peso');
    const valorPeso = parseFloat(inputPeso.value);
    
    if (!valorPeso || valorPeso <= 0) { alert("Introduza um peso válido!"); return; }
    
    const novoRegistro = {
        id: Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        peso: valorPeso
    };
    
    historicoPesos.unshift(novoRegistro);
    inputPeso.value = "";
    
    salvarDadosUsuario();
    atualizarInterfacePerfil();
    renderizarHistoricoPesos();
});

function renderizarHistoricoPesos() {
    const container = document.getElementById('historico-pesos');
    container.innerHTML = "";
    
    if(historicoPesos.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 14px;">Sem registos de peso ainda.</p>`;
        return;
    }
    
    // Mostra as últimas 5 evoluções de peso
    historicoPesos.slice(0, 5).forEach(p => {
        const item = document.createElement('div');
        item.style = "display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px;";
        item.innerHTML = `<span>📅 ${p.data}</span> <strong>${p.peso} kg</strong>`;
        container.appendChild(item);
    });
}

// Lógica de Renderização do Calendário de Treinos
function renderizarCalendario() {
    const grid = document.getElementById('dias-calendario-grid');
    const txtMesAno = document.getElementById('mes-ano-calendario');
    grid.innerHTML = "";
    
    const ano = dataAtualCalendario.getFullYear();
    const mes = dataAtualCalendario.getMonth();
    
    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    txtMesAno.innerText = `${nomesMeses[mes]} ${ano}`;
    
    const primeiroDiaMes = new Date(ano, mes, 1).getDay();
    const totalDiasNoMes = new Date(ano, mes + 1, 0).getDate();
    
    // Mapeia todos os dias treinados do histórico para este mês e ano específicos
    const diasTreinados = historicoTreinos.filter(t => {
        const partes = t.data.split('/'); // DD/MM/AAAA
        return parseInt(partes[1]) === (mes + 1) && parseInt(partes[2]) === ano;
    }).map(t => parseInt(t.data.split('/')[0]));

    // Cria os espaços em branco para alinhar o primeiro dia da semana
    for (let i = 0; i < primeiroDiaMes; i++) {
        const vazio = document.createElement('div');
        grid.appendChild(vazio);
    }
    
    // Gera os dias reais do mês
    for (let dia = 1; dia <= totalDiasNoMes; dia++) {
        const celula = document.createElement('div');
        celula.className = "dia-celula";
        celula.innerText = dia;
        
        // Se o utilizador treinou neste dia, destaca a célula em verde neon!
        if (diasTreinados.includes(dia)) {
            celula.classList.add('treinado');
            celula.title = "Treinaste neste dia!";
        }
        
        grid.appendChild(celula);
    }
}

document.getElementById('btn-prev-mes').addEventListener('click', () => { dataAtualCalendario.setMonth(dataAtualCalendario.getMonth() - 1); renderizarCalendario(); });
document.getElementById('btn-next-mes').addEventListener('click', () => { dataAtualCalendario.setMonth(dataAtualCalendario.getMonth() + 1); renderizarCalendario(); });
document.getElementById('btn-alternar-privacidade').addEventListener('click', () => {
    perfilPublico = !perfilPublico;
    salvarDadosUsuario();
    atualizarInterfacePerfil();
});

// ==========================================================================
// 5. ENGINE DA REDE SOCIAL (FEED ESTILO INSTAGRAM EM TEMPO REAL)
// ==========================================================================
document.getElementById('btn-abrir-postar').addEventListener('click', () => {
    const caixa = document.getElementById('caixa-criar-post');
    caixa.style.display = caixa.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('btn-publicar-post').addEventListener('click', () => {
    const texto = document.getElementById('texto-post').value.trim();
    const urlFoto = document.getElementById('url-foto-post').value.trim();
    
    if(!texto) { alert("Escreve alguma coisa antes de publicar!"); return; }
    if(!perfilPublico) { alert("Aviso: O teu perfil está como PRIVADO. Altera para PÚBLICO no teu Perfil para partilhares treinos no Feed!"); return; }

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
    // Escuta o Firestore em tempo real. Quem publicar, aparece na hora para toda a gente!
    db.collection("feed").orderBy("dataHora", "desc").limit(20).onSnapshot((snapshot) => {
        const containerFeed = document.getElementById('lista-feed');
        containerFeed.innerHTML = "";
        
        if (snapshot.empty) {
            containerFeed.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:30px;">Ainda ninguém partilhou treinos hoje. Sê o primeiro!</p>`;
            return;
        }
        
        snapshot.forEach((doc) => {
            const post = doc.data();
            const card = document.createElement('div');
            card.className = "card-feed";
            
            let htmlFoto = post.foto ? `<img src="${post.foto}" class="post-img" onerror="this.style.display='none'">` : "";
            
            card.innerHTML = `
                <div class="post-user">🟢 @${post.usuario}</div>
                <p style="font-size:15px; line-height:1.5;">${post.texto}</p>
                ${htmlFoto}
            `;
            containerFeed.appendChild(card);
        });
    });
}

// ==========================================================================
// 6. ADICIONAR TREINOS, ROTINAS, CRONÓMETRO (LOGICA ANTERIOR ADAPTADA)
// ==========================================================================
const dicionarioFitness = [
    { termo: "rosca direta", opcoes: ["Rosca Direta com Barra W", "Rosca Direta com Halteres"] },
    { termo: "agachamento", opcoes: ["Agachamento Livre", "Agachamento Hack", "Agachamento Búlgaro"] },
    { termo: "supino", opcoes: ["Supino Reto com Barra", "Supino Inclinado com Halteres"] },
    { termo: "peito", opcoes: ["Supino Reto com Barra", "Peck Deck / Voador"] },
    { termo: "costas", opcoes: ["Puxada Alta", "Remada Baixa", "Puxada Cavalo"] },
    { termo: "perna", opcoes: ["Leg Press 45°", "Cadeira Extensora", "Mesa Flexora"] }
];

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
                    if (exerciciosNoTreino.some(e => e.nome === opcao)) { alert("Já adicionaste este exercício!"); return; }
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

    const corpoTabela = card.querySelector('.corpo-tabela-series');
    function criarLinhaSerie(peso = "", reps = "") {
        const num = corpoTabela.children.length + 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span>${num}</span></td>
            <td><input type="number" class="input-num kg-input" value="${peso}" style="width:60px; background:#121212; border:1px solid #333; color:#fff; text-align:center;" placeholder="-"></td>
            <td><input type="number" class="input-num reps-input" value="${reps}" style="width:60px; background:#121212; border:1px solid #333; color:#fff; text-align:center;" placeholder="-"></td>
            <td><button class="btn-check-set" style="background:none; border:none; color:var(--text-muted); cursor:pointer;"><i class="fa-solid fa-check"></i></button></td>
        `;
        tr.querySelector('.btn-check-set').addEventListener('click', (e) => {
            e.target.closest('.btn-check-set').classList.toggle('feito');
            e.target.closest('.btn-check-set').style.color = e.target.closest('.btn-check-set').classList.contains('feito') ? 'var(--primary)' : 'var(--text-muted)';
        });
        corpoTabela.appendChild(tr);
    }

    if (dadosSeries) dadosSeries.forEach(s => criarLinhaSerie(s.peso, s.reps));
    else { criarLinhaSerie(); criarLinhaSerie(); }

    card.querySelector('.btn-add-set').addEventListener('click', () => criarLinhaSerie());
    treinoAtual.appendChild(card);
    exerciciosNoTreino.push({ nome: nomeExercicio, element: card });
}

document.getElementById('btn-salvar-rotina').addEventListener('click', () => {
    const nome = nomeTreinoInput.value.trim();
    if (!nome) { alert("Dá um nome ao treino!"); return; }
    if (exerciciosNoTreino.length === 0) { alert("Adiciona pelo menos um exercício!"); return; }

    const exerciciosDados = [];
    treinoAtual.querySelectorAll('.card-exercicio').forEach(card => {
        const nomeEx = card.dataset.nome;
        const seriesDados = [];
        card.querySelectorAll('.corpo-tabela-series tr').forEach(tr => {
            seriesDados.push({ peso: tr.querySelector('.kg-input').value, reps: tr.querySelector('.reps-input').value });
        });
        exerciciosDados.push({ nome: nomeEx, series: seriesDados });
    });

    const novaRotina = { nome, exercicios: exerciciosDados };
    if (idEdicaoAtual !== null) { rotinasSalvas[idEdicaoAtual] = novaRotina; idEdicaoAtual = null; } 
    else { rotinasSalvas.push(novaRotina); }

    salvarDadosUsuario();
    nomeTreinoInput.value = "";
    treinoAtual.innerHTML = "";
    exerciciosNoTreino = [];
    atualizarInterfacePerfil();
    renderizarTreinosProntos();
    alert("Treino guardado com sucesso!");
});

function renderizarTreinosProntos() {
    const lista = document.getElementById('lista-treinos-salvos');
    lista.innerHTML = "";
    if (rotinasSalvas.length === 0) { lista.innerHTML = `<p style="color:var(--text-muted);">Nenhum treino guardado.</p>`; return; }

    rotinasSalvas.forEach((treino, index) => {
        const div = document.createElement('div');
        div.className = 'card-feed';
        div.style.padding = "20px";
        const listaExs = treino.exercicios.map(e => `• ${e.nome} (${e.series.length} séries)`).join('<br>');
        div.innerHTML = `
            <h3>${treino.nome}</h3>
            <p style="margin: 10px 0; color:#aaa; font-size:14px;">${listaExs}</p>
            <button onclick="iniciarSessaoTreino(${index})" style="background:var(--primary); border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-weight:bold;">Iniciar</button>
        `;
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
    if(exerciciosNoTreino.length === 0) { alert("Adiciona exercícios primeiro!"); return; }
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
    const dataAtual = new Date().toLocaleDateString('pt-BR'); // Guarda em formato DD/MM/AAAA
    
    let totalCargaTreino = 0;
    const exerciciosFeitos = [];

    treinoAtual.querySelectorAll('.card-exercicio').forEach(card => {
        const nomeEx = card.dataset.nome;
        const totalSets = card.querySelectorAll('.corpo-tabela-series tr').length;
        
        card.querySelectorAll('.corpo-tabela-series tr').forEach(tr => {
            const kg = parseFloat(tr.querySelector('.kg-input').value) || 0;
            const reps = parseFloat(tr.querySelector('.reps-input').value) || 0;
            totalCargaTreino += (kg * reps);
        });
        
        exerciciosFeitos.push({ nome: nomeEx, sets: totalSets });
    });

    const novaSessao = {
        id: Date.now(),
        nome: nomeTreinoAtivoAtualmente || "Treino Rápido",
        data: dataAtual,
        tempo: tempoFinal,
        volume: totalCargaTreino + " kg",
        exercicios: exerciciosFeitos
    };

    historicoTreinos.unshift(novaSessao);
    salvarDadosUsuario();
    
    clearInterval(timerInterval);
    document.getElementById('timer-global').style.display = 'none';
    nomeTreinoInput.value = "";
    treinoAtual.innerHTML = "";
    exerciciosNoTreino = [];
    
    alert(`Treino Concluído! Volume Total Movimentado: ${totalCargaTreino} kg!`);
    mudarAba('historico');
});

function renderizarHistorico() {
    const container = document.getElementById('lista-historico');
    container.innerHTML = "";
    if (historicoTreinos.length === 0) { container.innerHTML = `<p style="color:var(--text-muted);">Nenhum treino no histórico.</p>`; return; }

    historicoTreinos.forEach(h => {
        const div = document.createElement('div');
        div.className = 'card-feed';
        let htmlExs = h.exercicios.map(e => `🔹 ${e.sets} séries de ${e.nome}`).join('<br>');
        div.innerHTML = `
            <h3>${h.nome}</h3>
            <p style="font-size:13px; color:var(--primary); margin:5px 0;">📅 ${h.data} • ⏱️ ${h.tempo} • 🏋️ Vol: ${h.volume}</p>
            <p style="font-size:14px; color:#ddd; line-height:1.5;">${htmlExs}</p>
        `;
        container.appendChild(div);
    });
}

// Autenticação básica
document.getElementById('link-ir-cadastrar').addEventListener('click', (e) => { e.preventDefault(); formLogin.style.display = 'none'; formCadastro.style.display = 'block'; });
document.getElementById('link-ir-login').addEventListener('click', (e) => { e.preventDefault(); formCadastro.style.display = 'none'; formLogin.style.display = 'block'; });

document.getElementById('btn-registrar').addEventListener('click', () => {
    const userIn = document.getElementById('cad-usuario').value.trim();
    const senha = document.getElementById('cad-senha').value;
    const email = userIn.includes('@') ? userIn : `${userIn}@alphafit.com`;
    auth.createUserWithEmailAndPassword(email, senha).then(() => alert("Conta criada!")).catch(e => alert(e.message));
});

document.getElementById('btn-entrar').addEventListener('click', () => {
    const userIn = document.getElementById('login-usuario').value.trim();
    const senha = document.getElementById('login-senha').value;
    const email = userIn.includes('@') ? userIn : `${userIn}@alphafit.com`;
    auth.signInWithEmailAndPassword(email, senha).catch(e => alert("Dados inválidos!"));
});

document.getElementById('btn-sair-usuario').addEventListener('click', () => { auth.signOut().then(() => location.reload()); });
