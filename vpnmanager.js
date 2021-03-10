// Documentação do cockpit:
// https://cockpit-project.org/guide/latest/development.html

// Script que a gente vai seguir para o setup da VPN (caso o OpenVPN não estiver instalado):
// https://raw.githubusercontent.com/angristan/openvpn-install/master/openvpn-install.sh

const LATEST_EASYRSA_VERSION = '3.0.8';

const settingsScreen = document.getElementById('settings_screen');
const clientsScreen = document.getElementById('clients_screen');
const keysScreen = document.getElementById('keys_screen');

const divDashboard = document.getElementById('div-dashboard');
const spanServiceStatus = document.getElementById('span-service-status');
const btnToggleServiceState = document.getElementById('btn-toggle-service-state');
const btnRestartService = document.getElementById('btn-restart-service')
      btnRestartService.onclick = restartServer;

const inputPort = document.getElementById("input-port");
const inputMaxClients = document.getElementById("input-max-client");
const selectProtocol = document.getElementById("select-proto");
const inputDns = document.getElementById("input-dns");
const selectCompression = document.getElementById("select-compression");

const divVpnNotInstalled = document.getElementById('div-not-installed');
const spanVpnNotInstallednformation = document.getElementById('span-not-installed-information');
const btnInstallVpn = document.getElementById('btn-install-vpn');
      btnInstallVpn.onclick = installOpenVPN;

const btnApplyChanges = document.getElementById('btn-apply');
      btnApplyChanges.onclick = updateServer;

const divSetupingVpn = document.getElementById('div-setuping-vpn');
const setupingVpnOutput = document.getElementById('setuping-output');

serverConf = "";

function drawDashboard(data) {
    hideNextStepScreen();
    hideExecutingStepScreen();
    loadConfig();
    showDashboard();    
}

function loadConfig() {
    let inputs =  [inputDns, inputMaxClients, inputPort, selectProtocol, selectCompression];

    function setServiceState() {
        execute({
            command: ['systemctl', 'show', '-p', 'SubState', '--value', 'openvpn-server@server'],
            stream: (data) => {
                spanServiceStatus.innerHTML = data;
                
                if (data === "running\n") {
                    btnToggleServiceState.innerHTML = "Stop";
                    btnToggleServiceState.onclick = () => execute({command: ['systemctl', 'stop', 'openvpn-server@server'], next:setServiceState});
                }
                else {
                    btnToggleServiceState.innerHTML = "Start";
                    btnToggleServiceState.onclick = () => execute({command: ['systemctl', 'start', 'openvpn-server@server'], next:setServiceState});
                } 
            }
        });
    }    

    function getConfig(input, regex) {
        input.value = serverConf.match(new RegExp(regex))[1];
    }

    function getLimitedConfig(input, regex) {
        let match = serverConf.match(new RegExp(regex));
    
        if (match == undefined) {
            input.value = "null";
        }
        else {
            input.value = match[1];
        }
    }
    
    function getDns() {
        inputDns.value = "";
    
        let match = serverConf.match(/^push "dhcp-option DNS \d+\.\d+\.\d+\.\d+"\n?/gm);
        match.forEach(element => {
            let match = element.match(/push "dhcp-option DNS (\d+\.\d+\.\d+\.\d+)"/);
    
            inputDns.value += match[1] + ", ";
        });
    
        inputDns.value = inputDns.value.replace(/, $/g,'');
    }

    execute({
        command: ["cat", "/etc/openvpn/server.conf"],
        stream: (data) => {
            serverConf = data;
            setServiceState();
            getConfig(inputPort, "port ([0-9]*)");
            getConfig(inputMaxClients, "max-clients ([0-9]*)");
            getConfig(selectProtocol,);
            getLimitedConfig(selectCompression, /^compress (lz4-v2|lz4|lzo)$/m);
            getLimitedConfig(selectProtocol, /^proto (udp|tcp)$/m);
            getDns();
            inputs.forEach(input => {
                input.disabled = false;
            })
        }
    })
}


function restartServer() {
    spanServiceStatus.innerHTML = "Restarting...";
    let inputs =  [inputDns, inputMaxClients, inputPort, selectProtocol, selectCompression];

    inputs.forEach(input => {
        input.disabled = true;
        input.value = "...";
    });
    
    execute({
        command: ['systemctl', 'restart', 'openvpn-server@server'],
        next: loadConfig
    });
}

function updateServer() {
    serverConf = serverConf.replace(/^proto (udp|tcp)$/m, `proto ${selectProtocol.value}`);
    serverConf = serverConf.replace(/^port [0-9]*$/m, `port ${inputPort.value}`);
    serverConf = serverConf.replace(/^max-clients ([0-9]*)$/m, `max-clients ${inputMaxClients.value}`);

    function changeCompress() {
        let disabled = selectCompression.value === "null";

        if (disabled) {
            selectCompression.value = "lz4-v2";
        }

        serverConf = serverConf.replace(/^;?compress (lz4-v2|lz4|lzo)$/m, `${disabled ? ";" : ""}compress ${selectCompression.value}`);
        serverConf = serverConf.replace(/^;?push "compress (lz4-v2|lz4|lzo)"$/m, `${disabled ? ";" : ""}push "compress ${selectCompression.value}"`);
    }

    function changeDns() {
        let dns = inputDns.value.split(',');
        let dns1 = dns[0]?.trim();
        let dns2 = dns[1]?.trim();
    
        serverConf = serverConf.replace(/^push "dhcp-option DNS \d+\.\d+\.\d+\.\d+"\n?/gm, "");
    
        if (dns1 != undefined)
            serverConf += `push "dhcp-option DNS ${dns1}"\n`;
        if (dns2 != undefined)
            serverConf += `push "dhcp-option DNS ${dns2}"`;
    }

    changeDns();
    changeCompress();

    execute({
        script: `echo '${serverConf}' > /etc/openvpn/server.conf`,
        next: restartServer
    });
}

function isOpenVpnInstalled() {
    function installOpenVpnMessage(data) {
        function buildMessage(user) {
            if (user.id != 0) {
                spanVpnNotInstallednformation.innerHTML += ' You need to be logged as root to install it.';
            }
            else {
                btnInstallVpn.onclick = installOpenVPN;
                btnInstallVpn.innerHTML = 'Install OpenVPN';
            }
    
            showNextStepScreen();
        }
        
        cockpit.user().then(buildMessage);
    }

    cockpit.spawn(['test', '-e', '/etc/openvpn/server.conf'])
        .then(drawDashboard)
        .catch(installOpenVpnMessage); 
}

function installOpenVPN() {
    hideNextStepScreen();
    showExecutingStepScreen();
    
    cockpit.script("./installation.sh", {
         directory: "/usr/share/cockpit/pinger" 
    })
    .stream(writeOutput)
    .then(drawDashboard)
    .catch(writeError);
}

// Não tenho ctz se aqui é o lugar correto para executar as primeiras verificações.
// Não procurei nada sobre OnDocumentLoaded()
cockpit.transport.wait(function() { 
    hideDashboard();
    hideExecutingStepScreen();
    isOpenVpnInstalled();
});

// Utils.js
function hideDashboard() {
    clientsScreen.style.display = 'none';
    keysScreen.style.display = 'none';
    divDashboard.style.display = 'none';
}
function showDashboard() {
    divDashboard.style.display = 'block';
}
function hideNextStepScreen() {
    divVpnNotInstalled.style.display = 'none';
}
function showNextStepScreen() {
    divVpnNotInstalled.style.display = 'block';
}
function showExecutingStepScreen() {
    divSetupingVpn.style.display = 'block';
}
function hideExecutingStepScreen() {
    divSetupingVpn.style.display = 'none';
}
function clearOutput() {
    setupingVpnOutput.innerHTML = '';
}
function writeOutput(data) {
    setupingVpnOutput.append(document.createTextNode(data));
}
function writeError(data) {
    console.error(data);
    errorOutput.innerHTML += `<span style="color:red">${data}</span>`;
}

function execute(args) {
    if (args.stream == undefined) {
        args.stream = (data) => console.log(data);
    }
    if (args.command != undefined) {
        console.log(args.command);
        cockpit.spawn(args.command).stream(args.stream).then(args.next).catch((data) => console.error(data))
    }
    else if (args.script != undefined) {
        console.log(args.script);
        cockpit.script(args.script).stream(args.stream).then(args.next).catch((data) => console.error(data))
    }
}   