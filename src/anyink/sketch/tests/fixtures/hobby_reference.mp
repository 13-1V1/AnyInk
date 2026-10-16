% S1 hobby.js reference paths. Run: mpost hobby_reference.mp; read the log.
% Each line prints, per piece: point i, postcontrol i, precontrol i+1.
tracingonline := 1;
def dump(expr p) = for i = 0 upto length p - 1: show point i of p, postcontrol i of p, precontrol (i+1) of p; endfor enddef;
message "arch3"; dump((0,0)..(100,100)..(200,0));
message "open5"; dump((0,0)..(60,120)..(170,140)..(260,40)..(330,90));
message "cyclic5"; dump((0,0)..(200,133)..(130,300)..(33,233)..(100,167)..cycle);
message "oval4"; dump((300,0)..(0,200)..(-300,0)..(0,-200)..cycle);
message "line2"; dump((10,20)..(250,90));
message "dirMiddle"; dump((0,0)..(100,100){right}..(200,0));
message "dirEnds"; dump((0,0){up}..(100,80)..(200,0){down});
message "dirOneEnd"; dump((0,0){dir 30}..(120,40));
message "tension2"; dump((0,0)..tension 2..(100,100)..(200,0));
message "tensionAB"; dump((0,0)..tension 0.75 and 3..(100,100)..(200,0));
message "tensionMiddle"; dump((0,0)..(80,120)..tension 1.4 and 2.5..(220,140)..(300,30));
message "dirTension"; dump((0,0){dir 60}..tension 1.5..(150,120){dir -20}..(300,0));
message "cyclicDir"; dump((0,0)..(100,0){up}..(100,100)..(0,100)..cycle);
message "cyclicTension"; dump((0,0)..tension 1.3..(100,0)..(100,100)..tension 3 and 0.9..(0,100)..cycle);
message "corner"; dump((0,0)..(100,100) & (100,100)..(200,40)..(260,120));
end
