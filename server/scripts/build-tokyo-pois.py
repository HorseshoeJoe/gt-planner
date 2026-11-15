"""
Generates server/src/data/pois/tokyo.json from the compact table below.
Columns: name, category, area, lat, lng, popularity (1-5), entry fee (JPY, 0 = free), typical visit (min)
Coordinates are hand-curated to ~3-4 decimals (roughly 10-100 m). Phase II's Overpass enrichment
(W6) should verify/overwrite them.
"""
import json, re, pathlib

ROWS = [
# Temples, shrines, historic
("Senso-ji Temple","temple","Asakusa",35.7148,139.7967,4.7,0,90),
("Nakamise-dori","shopping","Asakusa",35.7117,139.7964,4.4,0,45),
("Asakusa Culture Tourist Information Center","viewpoint","Asakusa",35.7102,139.7961,4.3,0,20),
("Sumida River Cruise (Asakusa Pier)","experience","Asakusa",35.7104,139.7985,4.3,1000,40),
("Meiji Jingu","shrine","Shibuya",35.6764,139.6993,4.7,0,90),
("Nezu Shrine","shrine","Bunkyo",35.7270,139.7607,4.4,0,45),
("Yasukuni Shrine","shrine","Chiyoda",35.6944,139.7436,4.4,0,45),
("Kanda Myojin","shrine","Chiyoda",35.7020,139.7679,4.3,0,30),
("Hie Shrine","shrine","Akasaka",35.6740,139.7403,4.3,0,30),
("Zojo-ji","temple","Minato",35.6574,139.7455,4.4,0,45),
("Gotoku-ji","temple","Setagaya",35.6486,139.6469,4.3,0,45),
("Hanazono Shrine","shrine","Shinjuku",35.6924,139.7064,4.2,0,30),
("Tomioka Hachimangu","shrine","Koto",35.6720,139.7966,4.2,0,30),
("Yushima Tenmangu","shrine","Bunkyo",35.7077,139.7683,4.3,0,30),
("Sengaku-ji","temple","Minato",35.6385,139.7370,4.1,500,45),
("Ueno Toshogu","shrine","Taito",35.7157,139.7721,4.3,500,45),
("Jindai-ji","temple","Chofu",35.6726,139.5551,4.4,0,60),
("Tsukiji Hongwanji","temple","Chuo",35.6667,139.7727,4.2,0,30),
("Shibamata Taishakuten","temple","Katsushika",35.7600,139.8776,4.3,400,90),
("Akasaka Palace State Guest House","historic","Minato",35.6807,139.7266,4.2,1500,60),
("Kyu Iwasaki-tei Gardens","historic","Taito",35.7094,139.7694,4.1,400,45),
("Yanaka Cemetery","historic","Taito",35.7247,139.7701,4.2,0,45),
# Landmarks and viewpoints
("Tokyo Imperial Palace East Gardens","park","Chiyoda",35.6852,139.7528,4.4,0,90),
("Imperial Palace Outer Garden (Nijubashi)","landmark","Chiyoda",35.6797,139.7573,4.4,0,30),
("Tokyo Tower","landmark","Minato",35.6586,139.7454,4.5,1500,75),
("Tokyo Skytree","landmark","Sumida",35.7101,139.8107,4.5,2100,90),
("Shibuya Sky","viewpoint","Shibuya",35.6585,139.7021,4.6,2200,75),
("Shibuya Crossing","landmark","Shibuya",35.6595,139.7005,4.5,0,30),
("Hachiko Statue","landmark","Shibuya",35.6590,139.7004,4.1,0,15),
("Tokyo Metropolitan Government Building Observatory","viewpoint","Shinjuku",35.6896,139.6921,4.4,0,45),
("Tokyo City View (Roppongi Hills)","viewpoint","Minato",35.6606,139.7292,4.4,2000,75),
("Tokyo Station Marunouchi Building","landmark","Chiyoda",35.6812,139.7671,4.5,0,30),
("KITTE Garden Rooftop","viewpoint","Chiyoda",35.6797,139.7650,4.2,0,30),
("Tokyo International Forum","landmark","Chiyoda",35.6764,139.7633,4.2,0,30),
("Rainbow Bridge Promenade","landmark","Minato",35.6364,139.7634,4.4,0,30),
("Unicorn Gundam Statue (DiverCity)","landmark","Koto",35.6249,139.7752,4.5,0,30),
("Godzilla Head (Shinjuku Toho Building)","landmark","Shinjuku",35.6958,139.7019,4.1,0,15),
("Yoyogi National Gymnasium","landmark","Shibuya",35.6683,139.6996,4.2,0,20),
# Museums and culture
("teamLab Planets","museum","Koto",35.6492,139.7896,4.6,3800,120),
("teamLab Borderless (Azabudai Hills)","museum","Minato",35.6612,139.7400,4.6,3800,150),
("Tokyo National Museum","museum","Taito",35.7188,139.7765,4.5,1000,120),
("National Museum of Nature and Science","museum","Taito",35.7160,139.7760,4.4,630,120),
("National Museum of Western Art","museum","Taito",35.7156,139.7758,4.3,500,90),
("Sumida Hokusai Museum","museum","Sumida",35.6962,139.8027,4.2,400,60),
("Mori Art Museum","museum","Minato",35.6604,139.7292,4.3,2000,90),
("The National Art Center, Tokyo","museum","Minato",35.6653,139.7263,4.2,1000,90),
("Nezu Museum","museum","Minato",35.6619,139.7167,4.5,1300,90),
("Ghibli Museum","museum","Mitaka",35.6962,139.5704,4.6,1000,120),
("Tokyo Metropolitan Teien Art Museum","museum","Minato",35.6372,139.7176,4.2,1200,75),
("Miraikan","museum","Koto",35.6199,139.7766,4.3,630,120),
("Asakura Museum of Sculpture","museum","Taito",35.7281,139.7680,4.2,500,60),
("Shitamachi Museum","museum","Taito",35.7113,139.7734,4.0,300,45),
("Ginza Kabuki-za","theater","Chuo",35.6694,139.7681,4.4,2000,90),
("Ryogoku Kokugikan (Sumo)","theater","Sumida",35.6969,139.7934,4.4,4500,150),
# Parks and gardens
("Shinjuku Gyoen","park","Shinjuku",35.6852,139.7101,4.6,500,120),
("Ueno Park","park","Taito",35.7148,139.7737,4.5,0,90),
("Shinobazu Pond","park","Taito",35.7123,139.7701,4.3,0,45),
("Yoyogi Park","park","Shibuya",35.6715,139.6949,4.4,0,60),
("Inokashira Park","park","Musashino",35.7009,139.5800,4.4,0,90),
("Hamarikyu Gardens","park","Chuo",35.6594,139.7632,4.4,300,75),
("Rikugien Garden","park","Bunkyo",35.7330,139.7469,4.5,300,60),
("Koishikawa Korakuen","park","Bunkyo",35.7064,139.7515,4.4,300,60),
("Kiyosumi Gardens","park","Koto",35.6803,139.7983,4.2,150,45),
("Happo-en","park","Minato",35.6446,139.7287,4.3,0,45),
("Chidorigafuchi Moat","park","Chiyoda",35.6914,139.7457,4.5,0,45),
("Kitanomaru Park","park","Chiyoda",35.6920,139.7500,4.3,0,45),
("Sumida Park","park","Sumida",35.7137,139.8032,4.3,0,45),
("Meiji Jingu Gaien Ginkgo Avenue","park","Minato",35.6757,139.7184,4.5,0,45),
("Odaiba Seaside Park","park","Minato",35.6300,139.7750,4.3,0,60),
("Shiba Park","park","Minato",35.6540,139.7497,4.1,0,45),
("Hibiya Park","park","Chiyoda",35.6741,139.7561,4.1,0,45),
("Asukayama Park","park","Kita",35.7517,139.7365,4.1,0,60),
("Todoroki Valley","park","Setagaya",35.6065,139.6477,4.2,0,60),
("Showa Kinen Park","park","Tachikawa",35.7089,139.4003,4.4,450,180),
("Mount Takao","nature","Hachioji",35.6251,139.2437,4.6,0,240),
# Neighbourhoods, shopping, markets
("Shinjuku Golden Gai","neighborhood","Shinjuku",35.6940,139.7035,4.3,0,75),
("Omoide Yokocho","neighborhood","Shinjuku",35.6930,139.6997,4.2,0,60),
("Takeshita Street","shopping","Shibuya",35.6704,139.7058,4.2,0,60),
("Omotesando","shopping","Shibuya",35.6654,139.7121,4.3,0,60),
("Cat Street","shopping","Shibuya",35.6677,139.7053,4.2,0,45),
("Shibuya Center Gai","neighborhood","Shibuya",35.6603,139.6985,4.1,0,45),
("Shibuya PARCO","shopping","Shibuya",35.6616,139.6987,4.2,0,60),
("Ameyoko Market","market","Taito",35.7106,139.7743,4.3,0,60),
("Tsukiji Outer Market","market","Chuo",35.6655,139.7707,4.5,0,90),
("Toyosu Fish Market","market","Koto",35.6455,139.7845,4.3,0,75),
("Nakano Broadway","shopping","Nakano",35.7060,139.6657,4.3,0,90),
("Akihabara Electric Town","shopping","Chiyoda",35.6984,139.7731,4.4,0,120),
("Kappabashi Kitchen Town","shopping","Taito",35.7155,139.7898,4.2,0,60),
("Ginza","shopping","Chuo",35.6717,139.7650,4.4,0,90),
("Shimokitazawa","neighborhood","Setagaya",35.6613,139.6680,4.3,0,120),
("Yanaka Ginza","neighborhood","Taito",35.7279,139.7667,4.4,0,75),
("Kagurazaka","neighborhood","Shinjuku",35.7014,139.7405,4.3,0,75),
("Daikanyama T-Site","shopping","Shibuya",35.6486,139.6990,4.3,0,60),
("Nakameguro Canal","neighborhood","Meguro",35.6440,139.6990,4.4,0,60),
("Ebisu Garden Place","shopping","Shibuya",35.6419,139.7134,4.2,0,60),
("Tokyo Midtown","shopping","Minato",35.6659,139.7310,4.3,0,60),
("Azabudai Hills","shopping","Minato",35.6615,139.7405,4.3,0,60),
("Koenji","neighborhood","Suginami",35.7058,139.6498,4.1,0,90),
("Kichijoji Harmonica Yokocho","neighborhood","Musashino",35.7030,139.5790,4.2,0,60),
("Nippori Fabric Town","shopping","Arakawa",35.7280,139.7710,4.0,0,60),
("Tsukishima Monja Street","neighborhood","Chuo",35.6640,139.7835,4.1,0,60),
("Tokyo Ramen Street","food","Chiyoda",35.6807,139.7685,4.2,0,60),
("Tokyo Character Street","shopping","Chiyoda",35.6803,139.7685,4.2,0,45),
("Sunshine City (Ikebukuro)","shopping","Toshima",35.7295,139.7185,4.1,0,90),
# Family / attractions
("Tokyo Disneyland","theme park","Urayasu",35.6329,139.8804,4.6,9400,480),
("Tokyo DisneySea","theme park","Urayasu",35.6267,139.8851,4.7,9400,480),
("Tokyo Dome City","theme park","Bunkyo",35.7056,139.7519,4.2,0,120),
("Sunshine Aquarium","aquarium","Toshima",35.7290,139.7194,4.0,2600,90),
("Sumida Aquarium","aquarium","Sumida",35.7103,139.8110,4.1,2500,90),
("Tokyo Sea Life Park","aquarium","Edogawa",35.6466,139.8620,4.1,700,90),
("Ueno Zoo","zoo","Taito",35.7167,139.7713,4.2,600,150),
]

def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
def tier(fee): return 0 if fee==0 else 1 if fee<=1000 else 2 if fee<=3000 else 3

pois=[]
for n,cat,area,lat,lng,pop,fee,mins in ROWS:
    pois.append({"id":f"tokyo-{slug(n)}","name":n,"category":cat,"area":area,
                 "latitude":lat,"longitude":lng,"popularity":pop,
                 "entryFeeJPY":fee,"costTier":tier(fee),"avgVisitMinutes":mins})
out={"destination":"Tokyo","country":"Japan","aliases":["tokyo","tokyo japan","greater tokyo"],
     "currency":"JPY","source":"Hand-curated seed (CPAN 324 Phase I); to be verified by Overpass enrichment in Phase II",
     "pois":pois}
assert len({p["id"] for p in pois})==len(pois), "duplicate ids"
p=pathlib.Path(__file__).resolve().parent.parent/"src/data/pois/tokyo.json"
p.write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n")
print(len(pois),"POIs ->",p)
