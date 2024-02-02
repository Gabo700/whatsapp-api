# Instalação
<pre>
npm install
npm start
acessar navegador http://localhost:8000/
</pre>

# Recomendação:


![image](https://github.com/Gabo700/whatsapp-api/assets/82044329/efb086b4-14d8-4ff1-82df-be7a04a1c8e9)


Observe que o  node está ativo mas a API não está rodando para solucionar isso teremos que dar o seguinte comando no terminal do servidor:
root@:/var/www/html/Api-WhatsApp/api-whatsapp# kill361096
root@:/var/www/html/Api-WhatsApp/api-whatsapp# kill 361096 

Suas dependencias podem competir por portas o ideal é que a porta 8000 sempre esteja aberta e definida para a API


assim liberando a porta para acesso

vamos usar o NPM pm2 para evitar que isso aconteça e matenha a API sempre ativa 
então vamos utilizar o comando do pm2 para monitorar a atividade e manter ela sempre ativa 
pm2 start app.js --name api-whatsapp
caso já esteja em execução podemos forçar o inicio: 
pm2 start app.js --name api-whatsapp -f

podemos também utilizar o comando:
nohup node /var/www/html/Api-WhatsApp/api-whatsapp/app.js &
mas para fins de testes.
