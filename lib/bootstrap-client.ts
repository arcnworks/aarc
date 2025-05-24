const ASCIIArt = `

                                                                                            
                                                                                            
AAA                                 RRRRRRRRRRRRRRRRR           CCCCCCCCCCCCC
A:::A                                R::::::::::::::::R       CCC::::::::::::C
A:::::A                               R::::::RRRRRR:::::R    CC:::::::::::::::C
A:::::::A                              RR:::::R     R:::::R  C:::::CCCCCCCC::::C
A:::::::::A             aaaaaaaaaaaaa     R::::R     R:::::R C:::::C       CCCCCC
A:::::A:::::A            a::::::::::::a    R::::R     R:::::RC:::::C              
A:::::A A:::::A           aaaaaaaaa:::::a   R::::RRRRRR:::::R C:::::C              
A:::::A   A:::::A                   a::::a   R:::::::::::::RR  C:::::C              
A:::::A     A:::::A           aaaaaaa:::::a   R::::RRRRRR:::::R C:::::C              
A:::::AAAAAAAAA:::::A        aa::::::::::::a   R::::R     R:::::RC:::::C              
A:::::::::::::::::::::A      a::::aaaa::::::a   R::::R     R:::::RC:::::C              
A:::::AAAAAAAAAAAAA:::::A    a::::a    a:::::a   R::::R     R:::::R C:::::C       CCCCCC
A:::::A             A:::::A   a::::a    a:::::a RR:::::R     R:::::R  C:::::CCCCCCCC::::C
A:::::A               A:::::A  a:::::aaaa::::::a R::::::R     R:::::R   CC:::::::::::::::C
A:::::A                 A:::::A  a::::::::::aa:::aR::::::R     R:::::R     CCC::::::::::::C
AAAAAAA                   AAAAAAA  aaaaaaaaaa  aaaaRRRRRRRR     RRRRRRR        CCCCCCCCCCCCC
                                                                              
 
   AaRC - Architecture and Research in Culture

   AaRC(아크)는 과학적 통찰과 인문적 감수성으로 감정의 공간을 이야기 합니다.
   AaRC speaks of emotional space through scientific insight and humanistic sensitivity.
`;

export function bootstrap() {
  console.log(
    '%c%s',
    'color:#004FFF;font-size:16px;',
    '🔷 ---------------------------------------------------------------------- 🔷',
  );
  console.log('%c%s', 'color:#004FFF;', ASCIIArt);
  console.log(
    '%c%s',
    'color:#004FFF;font-size:16px;',
    '🔷 ---------------------------------------------------------------------- 🔷',
  );
}
