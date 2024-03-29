# pulsar-gpp-compiler

A fork of the [gpp-compiler](https://web.pulsar-edit.dev/packages/gpp-compiler), which is no longer being maintained.

This Pulsar package allows you to compile and run C++ and C within the editor.

To compile C or C++, press <kbd>F5</kbd> or right click the file in tree view and click `Compile and Run`.

To compile C or C++ and attach the GNU Debugger, press <kbd>F6</kbd> or right click the file in tree view and click `Compile and Debug`.

## Dependencies

This package relies on a C / C++ compiler (gcc).

### Linux

The GNU Compiler Collection may come with your distribution. Run `which gcc g++` to find out.

If that command does not output

```
/usr/bin/gcc
/usr/bin/g++
```

you will need to install it.

For RHEL-based distros, run `sudo dnf install gcc gcc-c++`.

For Debian-based distros, run `sudo apt install gcc g++`.

For Arch-based distros, run `sudo pacman -S gcc`.

### Windows

You'll need to install [MinGW-w64](https://www.mingw-w64.org/) and [add it to your PATH](http://www.howtogeek.com/118594/how-to-edit-your-system-path-for-easy-command-line-access/).

### Mac

You'll need to install [XCode](https://developer.apple.com/xcode/).

## Contributing

<!-- i did not test this "guide", so it may not work perfectly -->

```bash
# to start, you must fork this project
git clone https://github.com/<your username>/pulsar-gpp-compiler.git
cd pulsar-gpp-compiler
rm -rf ~/.pulsar/packages/pulsar-gpp-compiler
npm install # this will install developer dependencies (eslint)
ppm link # this will create a symbolic link from this directory to ~/.pulsar/packages
git checkout -b my-changes # this will create a new branch, change `my-changes` to something else
# make your changes
npm test # this will eslint `index.js`, if this gives you any errors, fix them
# test your changes in Pulsar, because you ran `ppm link`, this package will automatically load
git add .
git commit -m "added a feature"
git push
# go to https://github.com/<your username>/pulsar-gpp-compiler.git and click `Create Pull Request`
```
