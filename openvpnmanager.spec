Name: cockpitvpnmanager
Version: 1.0                      
Release: 1%{?dist}                 
Summary: A OpenVpn manager plugin for cockpit on CentOS.
Group: Productivity/Networking/Security            
License: LGPL
# URL:
Source0: cockpitvpnmanager-1.0.tar.gz    
BuildArch: noarch                  
BuildRoot: %{_tmppath}/%{name}-%{version}-%{release}-root-%(%{__id_u} -n)

# BuildRequires:                   

# Requires:                        

%description
A OpenVpn manager plugin for cockpit on CentOS

%prep

%setup -q

%build
# %configure                      
# make %{?_smp_mflags}                   

%install

rm -rf $RPM_BUILD_ROOT

# make install DESTDIR=$RPM_BUILD_ROOT    

install -d -m 0755 ~/.local/share/cockpit/CockpitVPNManager
#install -m 0755 HelloWorld.sh $RPM_BUILD_ROOT/opt/HelloWorld/HelloWorld.sh


%clean

rm -rf $RPM_BUILD_ROOT

%files

%defattr(-,root,root,-)

# %doc

#/opt/HelloWorld/HelloWorld.sh       <--- We confirm the file(s) to install

%changelog
