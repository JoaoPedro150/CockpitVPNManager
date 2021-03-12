Name:           vpnmanager
Version:        1
Release:        1%{?dist}
Summary:        User interface for managing SELinux permissions for services.

License:        MIT
URL:            https://www.github.com/JoaoPedro150
Source0:        vpnmanager-1.tar.gz

BuildArch:      noarch
BuildRoot:      %{_tmppath}/%{name}-buildroot
%description
User interface for managing OpenVPN settings, keys and clients.

%prep

%setup -q

%install
mkdir -p %{buildroot}/usr/share/cockpit/vpnmanager/
cp -R * %{buildroot}/usr/share/cockpit/vpnmanager/

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root,-)
/usr/share/cockpit/vpnmanager/

%changelog
* Thu Mar 11 2021 Joao Pedro e Hugo
First package
