// Documentação do cockpit:
// https://cockpit-project.org/guide/latest/development.html

// Script que a gente vai seguir para o setup da VPN (caso o OpenVPN não estiver instalado):
// https://raw.githubusercontent.com/angristan/openvpn-install/master/openvpn-install.sh

const output = document.getElementById("output");

function isOpenVpnInstalled() {
    cockpit.spawn(["test", "-e", "/etc/openvpn/server.conf"])
        .then(data => {
            output.append(document.createTextNode("OpenVPN installed;\n")); 
        })
        .catch(data => {
            output.append(document.createTextNode("OpenVPN are not installed;\n"));
        });
}

function isRootUser(user) {
    if (user.id != 0) 
        output.append(document.createTextNode("You must be root to anage this settings.\n"));
    else 
        output.append(document.createTextNode("You are root user;\n"));
}

// Não tenho ctz se aqui é o lugar correto para executar as primeiras verificações.
// Não procurei nada sobre OnDocumentLoaded()
cockpit.transport.wait(function() { 
    isOpenVpnInstalled();

    cockpit.user().then(isRootUser);
});
