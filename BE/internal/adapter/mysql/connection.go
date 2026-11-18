package mysql

import (
	"time"

	mysqldriver "github.com/go-sql-driver/mysql"
	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Options struct{ Host, Database, User, Password string }

func Connect(o Options) (*Store, func() error, error) {
	dsn := mysqldriver.NewConfig()
	dsn.User = o.User
	dsn.Passwd = o.Password
	dsn.Net = "tcp"
	dsn.Addr = o.Host
	dsn.DBName = o.Database
	dsn.ParseTime = true
	dsn.Loc = time.UTC
	dsn.Timeout = 5 * time.Second
	dsn.ReadTimeout = 10 * time.Second
	dsn.WriteTimeout = 10 * time.Second
	dsn.Params = map[string]string{"charset": "utf8mb4", "time_zone": "'+00:00'"}
	db, e := gorm.Open(gormmysql.Open(dsn.FormatDSN()), &gorm.Config{TranslateError: true, Logger: logger.Default.LogMode(logger.Silent)})
	if e != nil {
		return nil, nil, e
	}
	sqlDB, e := db.DB()
	if e != nil {
		return nil, nil, e
	}
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	return New(db), sqlDB.Close, nil
}
