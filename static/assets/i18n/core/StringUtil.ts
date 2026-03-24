/**
 * StringUtil.ts - 字符串工具
 * @description 该类提供了一些常用的字符串处理方法，包括时间格式化、数字压缩等。
 * 
 * @author eathonq
 * @license MIT
 * @version v1.0.0
 * 
 * @created 2024-08-16
 * @modified 2026-03-14
 */

/** 字符串工具 */
export class StringUtil {

  /**
   * 转换日期时间（支持`秒数据`，`毫秒数据`，`now`, 正常日期数据）
   * @param date 数据字符串
   * @param format 格式
   * @returns string
   */
  static parseTime(date: string, format?: string): string {
    if (!date) return '';

    let _date: Date;
    if (date == "now") {
      _date = new Date();
    }
    else if (!isNaN(Number(date))) {
      if (String(date).length == 10) {
        _date = new Date(Number(date) * 1000);
      }
      else if (String(date).length == 13) {
        _date = new Date(Number(date));
      }
      else {
        _date = new Date("2022/1/1 00:00:00");
        _date.setSeconds(Number(date));
      }
    }
    else {
      _date = new Date(date.replace(/-/g, '/'));
    }

    return this.time(_date, format);
  }

  /**
   * 格式化时间
   * @param date 日期数据
   * @param format 格式化字符串，默认`yyyy-MM-dd hh:mm:ss`
   * @returns string
   * @example
   * stringFormat.time(new Date(), 'yyyy-MM-dd hh:mm:ss') // 2021-01-01 00:00:00
   */
  static time(date: Date, format?: string): string {
    if (!date) return '';
    if (!format) format = 'yyyy-MM-dd hh:mm:ss';

    /**
     * yyyy:年, 
     * M:年中的月份(1-12), 
     * d:月份中的天(1-31), 
     * H:小时(0-23), 
     * h:小时(0-11), 
     * m:分(0-59), 
     * s:秒(0-59), 
     * f:毫秒(0-999),
     * q:季度(1-4)
     */
    const dict: Record<string, string | number> = {
      yyyy: date.getFullYear(),
      M: date.getMonth() + 1,
      d: date.getDate(),
      H: date.getHours(),
      h: date.getHours() % 12 || 12,
      m: date.getMinutes(),
      s: date.getSeconds(),
      f: date.getMilliseconds(),
      q: Math.floor((date.getMonth() + 3) / 3),
      MM: ("" + (date.getMonth() + 101)).substring(1),
      dd: ("" + (date.getDate() + 100)).substring(1),
      HH: ("" + (date.getHours() + 100)).substring(1),
      hh: ("" + ((date.getHours() % 12 || 12) + 100)).substring(1),
      mm: ("" + (date.getMinutes() + 100)).substring(1),
      ss: ("" + (date.getSeconds() + 100)).substring(1),
      fff: ("" + (date.getMilliseconds() + 1000)).substring(1)
    };

    return format.replace(/yyyy|MM|dd|HH|hh|mm|ss|fff|M|d|H|h|m|s|f|q/g, function () {
      return String(dict[arguments[0]]);
    });
  }

  private static readonly _counts = [1000, 1000000, 1000000000, 1000000000000];
  private static readonly _units = ['', 'K', 'M', 'B', 'T'];
  /**
   * 将数字缩短显示为K,M,B,T单位
   * @param value 数字
   * @param fixNum 小数点后保留位数
   * @returns string
   */
  static kmbt(value: number, fixNum: number = 2): string {
    return this.compressUnit(value, this._counts, this._units, fixNum);
  }

  /**
  * 压缩任意单位的数字，后缀加上单位文字
  * @param value 数字
  * @param counts 压缩单位数组
  * @param units 压缩单位文字数组
  * @param fixNum 小数点后保留位数
  * @returns string
  * @example
  * 1. compressUnit(123456, [1000, 1000000, 1000000000, 1000000000000], ['', 'K', 'M', 'B', 'T']) // 123.46K
  * 2. compressUnit(123456, [10000, 100000000, 1000000000000, 10000000000000000], ['', '万', '亿', '兆', '京']) // 1.23万
  */
  static compressUnit(value: number, counts: number[], units: string[], fixNum: number = 2): string {
    let res: string | undefined;
    let index: number;

    for (index = 0; index < counts.length; index++) {
      const e = counts[index];
      if (value < e) {
        if (index > 0) {
          res = (value / counts[index - 1]).toFixed(fixNum);
        } else {
          res = Number(value).toFixed(0);
        }
        break;
      }
    }

    // value 超出最大阈值，使用最大单位
    if (res === undefined) {
      res = (value / counts[counts.length - 1]).toFixed(fixNum);
      index = counts.length;
    }

    return res + units[index];
  }

  //#region format
  /**
   * 格式化字符串
   * @param str 字符串
   * @param args 参数
   * @returns 格式化后的字符串
   * @example
   * 1. format("%5s","abc")       // "  abc"
   * 2. format("%.2f",123.456)    // "123.46"
   * 3. format("%p",0.1234)       // "12%" 
   * 4. format("%t",now)          // "2019-12-12 12:12:12"
   * 5. format("%k",1234.56)      // "1K"
   */
  static format(str: string, ...args: any[]): string {
    let i = -1;
    let params: any[] = [];
    if (args.length > 0 && Array.isArray(args[0])) {
      params = args[0];
    }
    else {
      params = args;
    }
    /**
     * 替换字符串
     * @param exp 表达式
     * @param p0 前后补齐（默认向前补齐，-向后补齐）
     * @param p1 补齐字符+补齐位数（补齐字符不设置按空格补齐，还支持`0`补齐）
     * @param p2 小数补齐位数(.2补齐两位小数，.3补齐三位小数)
     * @param p3 指定当前数字进制 (默认10进制，可选#2、#8、#16)
     * @param p4 转换格式 (`%`、`s`、`c`、`f`、`p`、`x`、`o`、`d`、`i`、`t`、`k`)
     * @returns 
     */
    function callback(exp: any, p0: any, p1: any, p2: any, p3: any, p4: any) {
      if (exp == '%%') return '%';
      if (params[++i] === undefined) return exp;
      exp = p2 ? parseInt(p2.substr(1)) : undefined;
      let base = p3 ? parseInt(p3.substr(1)) : undefined;
      let val: any;
      switch (p4) {
        case 's': val = params[i]; break;
        case 'c': val = typeof (params[i]) == 'number' ? String.fromCharCode(parseInt(params[i], 10)) : params[i][0]; break;
        case 'f': val = parseFloat(params[i]).toFixed(exp); break;
        case 'p': return (parseFloat(params[i]) * 100).toFixed(exp ? exp : 0) + '%';
        case 'x': val = parseInt(params[i]).toString(base ? base : 16); break;
        case 'o': val = parseInt(params[i]).toString(base ? base : 8); break;
        case 'i':
        case 'd': val = parseFloat(parseInt(params[i], base ? base : 10).toPrecision(exp)).toFixed(0); break;
        case 't': {
          let tf = "yyyy-MM-dd hh:mm:ss";
          switch (p1) {
            case '1':
              tf = "yyyy-MM-dd";
              break;
            case '2':
              tf = "HH:mm:ss";
              break;
            case '3':
              tf = "HH:mm:ss.fff";
              break;
          }
          return StringUtil.parseTime(String(params[i]), tf);
        }
        case 'k': return StringUtil.kmbt(params[i], p2 ? parseInt(p2.substr(1)) : 0);
      }
      val = typeof (val) == 'object' ? JSON.stringify(val) : val.toString(base);
      let sz = parseInt(p1); /* padding size */
      let ch = p1 && p1[0] == '0' ? '0' : ' '; /* is null? */
      while (val.length < sz) val = p0 !== undefined ? val + ch : ch + val; /* is minus? */
      return val;
    }
    let regex = /%(-)?(0?[0-9]+)?([.][0-9]+)?([#][0-9]+)?([%scfpxoditk])/g;
    return str.replace(regex, callback);
  }

  //#endregion
}