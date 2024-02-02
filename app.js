const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const mime = require('mime-types');

const port = process.env.PORT || 8000;

// Configuração do servidor Express
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

// Configuração para upload de arquivos
app.use(fileUpload({
  debug: false
}));

// Rota principal que envia o arquivo 'index.html'
app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: __dirname
  });
});

// Configuração do cliente WhatsApp
const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- este não funciona no Windows
      '--disable-gpu'
    ],
  },
  authStrategy: new LocalAuth()
});

// Eventos do cliente WhatsApp
client.on('message', msg => {
  // Tratamento de mensagens específicas
  if (msg.body == '!ping') {
    msg.reply('pong');
  } else if (msg.body == 'good morning') {
    msg.reply('selamat pagi');
  } else if (msg.body == '!groups') {
    // Obtém informações sobre os grupos do usuário
    client.getChats().then(chats => {
      const groups = chats.filter(chat => chat.isGroup);

      if (groups.length == 0) {
        msg.reply('Você ainda não faz parte de nenhum grupo.');
      } else {
        let replyMsg = '*SEUS GRUPOS*\n\n';
        groups.forEach((group, i) => {
          replyMsg += `ID: ${group.id._serialized}\nNome: ${group.name}\n\n`;
        });
        replyMsg += '_Você pode usar o ID do grupo para enviar uma mensagem para o grupo._'
        msg.reply(replyMsg);
      }
    });
  }

  // Código comentado para baixar e salvar arquivos de mídia
  // Descomente se desejar habilitar essa funcionalidade
  // if (msg.hasMedia) {
  //   msg.downloadMedia().then(media => { ... });
  // }
});

// Inicialização do cliente WhatsApp
client.initialize();

// Socket IO
io.on('connection', function(socket) {
  // Emitir mensagem ao conectar
  socket.emit('message', 'Conectando...');

  // Evento para receber o código QR e enviar ao cliente
  client.on('qr', (qr) => {
    console.log('RECEBENDO CÓDIGO QR', qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
      socket.emit('message', 'CÓDIGO QR RECEBIDO, ESCANEIE PARA AUTENTICAR!');
    });
  });
});

// Configuração do servidor para escutar na porta especificada
server.listen(port, function () {
  console.log(`Servidor iniciado em http://localhost:${port}`);
});


  client.on('ready', () => {
    socket.emit('ready', 'Whatsapp Conectado!');
    socket.emit('message', 'Whatsapp Conectado!');
  });

  client.on('authenticated', () => {
    socket.emit('authenticated', 'Whatsapp está autenticado!');
    socket.emit('message', 'Whatsapp está autenticado!');
    console.log('AUTHENTICATED');
  });

  client.on('auth_failure', function(session) {
    socket.emit('message', 'Auth failure, restarting...');
  });

  client.on('disconnected', (reason) => {
    socket.emit('message', 'Whatsapp está desconectado!');
    client.destroy();
    client.initialize();
  });



// Função assíncrona para verificar se um número está registrado no WhatsApp
const checkRegisteredNumber = async function(number) {
  const isRegistered = await client.isRegisteredUser(number);
  return isRegistered;
}

// Rota para enviar mensagem
app.post('/send-message', [
  body('number').notEmpty(),
  body('message').notEmpty(),
], async (req, res) => {
  // Validação dos parâmetros de entrada
  const errors = validationResult(req).formatWith(({ msg }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  // Formatação do número de telefone e da mensagem
  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;

  // Verifica se o número está registrado no WhatsApp
  const isRegisteredNumber = await checkRegisteredNumber(number);

  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: 'O número não está registrado'
    });
  }

  // Envia a mensagem para o número especificado
  client.sendMessage(number, message).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

// Rota para enviar mídia
app.post('/send-media', async (req, res) => {
  // Formatação do número de telefone, legenda e URL do arquivo
  const number = phoneNumberFormatter(req.body.number);
  const caption = req.body.caption;
  const fileUrl = req.body.file;

  // Obtém os dados da mídia da URL
  let mimetype;
  const attachment = await axios.get(fileUrl, {
    responseType: 'arraybuffer'
  }).then(response => {
    mimetype = response.headers['content-type'];
    return response.data.toString('base64');
  });

  // Cria um objeto MessageMedia com os dados obtidos
  const media = new MessageMedia(mimetype, attachment, 'Media');

  // Envia a mídia para o número especificado
  client.sendMessage(number, media, {
    caption: caption
  }).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

// Função assíncrona para encontrar um grupo pelo nome
const findGroupByName = async function(name) {
  // Obtém a lista de chats e procura por um grupo com o nome especificado
  const group = await client.getChats().then(chats => {
    return chats.find(chat => 
      chat.isGroup && chat.name.toLowerCase() == name.toLowerCase()
    );
  });
  return group;
}

// Rota para enviar mensagem para um grupo
// Você pode usar o ID do chat ou o nome do grupo
app.post('/send-group-message', [
  body('id').custom((value, { req }) => {
    if (!value && !req.body.name) {
      throw new Error('Valor inválido, você pode usar `id` ou `name`');
    }
    return true;
  }),
  body('message').notEmpty(),
], async (req, res) => {
  // Validação dos parâmetros de entrada
  const errors = validationResult(req).formatWith(({ msg }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }


   // Extração dos parâmetros da requisição
   let chatId = req.body.id;
   const groupName = req.body.name;
   const message = req.body.message;
 
   // Procura o grupo pelo nome se o ID não estiver especificado
   if (!chatId) {
     const group = await findGroupByName(groupName);
     if (!group) {
       return res.status(422).json({
         status: false,
         message: 'Nenhum grupo encontrado com o nome: ' + groupName
       });
     }
     chatId = group.id._serialized;
   }
 
   // Envia a mensagem para o grupo especificado
   client.sendMessage(chatId, message).then(response => {
     res.status(200).json({
       status: true,
       response: response
     });
   }).catch(err => {
     res.status(500).json({
       status: false,
       response: err
     });
   });
 });
 
 // Rota para limpar mensagens em um chat específico
 app.post('/clear-message', [
   body('number').notEmpty(),
 ], async (req, res) => {
   // Validação dos parâmetros de entrada
   const errors = validationResult(req).formatWith(({ msg }) => {
     return msg;
   });
 
   if (!errors.isEmpty()) {
     return res.status(422).json({
       status: false,
       message: errors.mapped()
     });
   }
 
   // Formatação do número de telefone
   const number = phoneNumberFormatter(req.body.number);
 
   // Verifica se o número está registrado no WhatsApp
   const isRegisteredNumber = await checkRegisteredNumber(number);
 
   if (!isRegisteredNumber) {
     return res.status(422).json({
       status: false,
       message: 'Esse número não está registrado'
     });
   }
 
   // Obtém o chat pelo ID
   const chat = await client.getChatById(number);
   
   // Limpa as mensagens do chat
   chat.clearMessages().then(status => {
     res.status(200).json({
       status: true,
       response: status
     });
   }).catch(err => {
     res.status(500).json({
       status: false,
       response: err
     });
   })
 });
 
 // Inicia o servidor na porta especificada
 server.listen(port, function() {
   console.log('API online na porta: ' + port);
 });