Name:           vpnmanager
Version:        1
Release:        1%{?dist}
Summary:        User interface for managing SELinux permissions for services.

License:        MIT
URL:            https://www.github.com/JoaoPedro150
Source0:        vpnmanager-1.tar.gz

%description
User interface for managing OpenVPN settings, keys and clients.

%prep

%setup -q

%install
mkdir -p %{buildroot}/usr/share/cockpit/vpnmanager/
cp -R styles vpnmanager.html vpnmanager.js installation.sh manifest.json %{buildroot}/usr/share/cockpit/vpnmanager/

%clean  
rm -rf $RPM_BUILD_ROOT

%files
/usr/share/cockpit/vpnmanager/styles
/usr/share/cockpit/vpnmanager/vpnmanager.html 
/usr/share/cockpit/vpnmanager/vpnmanager.js 
/usr/share/cockpit/vpnmanager/installation.sh 
/usr/share/cockpit/vpnmanager/manifest.json 

%changelog
* Thu Mar 11 2021 Joao Pedro e Hugo
First package
