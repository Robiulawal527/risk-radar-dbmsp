import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import Navbar from '../components/Navbar';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Plus, Edit, Trash2, Shield, BarChart, Users2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { generateCrimeData, crimeTypes, dhakaAreas } from '../utils/crimeData';

export default function AdminDashboard() {
  const { user, loading, isAdmin } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [crimes, setCrimes] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCrime, setEditingCrime] = useState(null);
  const [formData, setFormData] = useState({
    type: 'theft',
    area: 'Gulshan',
    description: '',
    severity: 2,
    victims: 1,
  });

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/dashboard');
      toast.error('Access denied. Admin privileges required.');
    }
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => {
    const crimeData = generateCrimeData();
    setCrimes(crimeData.slice(0, 50)); // Show first 50 for admin
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingCrime) {
      // Update existing crime
      setCrimes(crimes.map(c => 
        c.id === editingCrime.id 
          ? { ...c, ...formData, typeName: crimeTypes.find(t => t.id === formData.type).name }
          : c
      ));
      toast.success(language === 'en' ? 'Crime record updated!' : 'অপরাধ রেকর্ড আপডেট হয়েছে!');
    } else {
      // Add new crime
      const newCrime = {
        id: `crime-${Date.now()}`,
        ...formData,
        typeName: crimeTypes.find(t => t.id === formData.type).name,
        lat: dhakaAreas.find(a => a.name === formData.area).lat,
        lng: dhakaAreas.find(a => a.name === formData.area).lng,
        date: new Date().toISOString(),
        reportedBy: user?.fullName || user?.name || 'Admin',
        status: 'pending',
      };
      setCrimes([newCrime, ...crimes]);
      toast.success(language === 'en' ? 'New crime record added!' : 'নতুন অপরাধ রেকর্ড যোগ করা হয়েছে!');
    }
    
    setIsDialogOpen(false);
    setEditingCrime(null);
    setFormData({
      type: 'theft',
      area: 'Gulshan',
      description: '',
      severity: 2,
      victims: 1,
    });
  };

  const handleEdit = (crime) => {
    setEditingCrime(crime);
    setFormData({
      type: crime.type,
      area: crime.area,
      description: crime.description,
      severity: crime.severity,
      victims: crime.victims,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (crimeId) => {
    if (confirm(language === 'en' ? 'Delete this crime record?' : 'এই অপরাধ রেকর্ড মুছবেন?')) {
      setCrimes(crimes.filter(c => c.id !== crimeId));
      toast.success(language === 'en' ? 'Crime record deleted!' : 'অপরাধ রেকর্ড মুছে ফেলা হয়েছে!');
    }
  };

  if (loading) return null;
  if (!user || !isAdmin) return null;

  const stats = [
    {
      title: language === 'en' ? 'Total Records' : 'মোট রেকর্ড',
      value: crimes.length,
      icon: Shield,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: language === 'en' ? 'Pending Cases' : 'বিচারাধীন মামলা',
      value: crimes.filter(c => c.status === 'pending').length,
      icon: BarChart,
      color: 'from-orange-500 to-orange-600',
    },
    {
      title: language === 'en' ? 'Active Areas' : 'সক্রিয় এলাকা',
      value: new Set(crimes.map(c => c.area)).size,
      icon: Users2,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: language === 'en' ? 'This Month' : 'এই মাসে',
      value: crimes.filter(c => {
        const date = new Date(c.date);
        const now = new Date();
        return date.getMonth() === now.getMonth();
      }).length,
      icon: TrendingUp,
      color: 'from-red-500 to-red-600',
    },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {language === 'en' ? 'Admin Dashboard' : 'অ্যাডমিন ড্যাশবোর্ড'}
            </h1>
            <p className="text-gray-600 mt-1">
              {language === 'en' ? 'Manage crime records and system data' : 'অপরাধ রেকর্ড এবং সিস্টেম ডেটা পরিচালনা করুন'}
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700">
                <Plus className="w-4 h-4 mr-2" />
                {language === 'en' ? 'Add Crime Record' : 'অপরাধ রেকর্ড যোগ করুন'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingCrime 
                    ? (language === 'en' ? 'Edit Crime Record' : 'অপরাধ রেকর্ড সম্পাদনা')
                    : (language === 'en' ? 'Add New Crime Record' : 'নতুন অপরাধ রেকর্ড যোগ করুন')
                  }
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'en' ? 'Crime Type' : 'অপরাধের ধরন'}
                  </label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {crimeTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {language === 'en' ? type.name : type.namebn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'en' ? 'Area' : 'এলাকা'}
                  </label>
                  <Select
                    value={formData.area}
                    onValueChange={(value) => setFormData({ ...formData, area: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dhakaAreas.map(area => (
                        <SelectItem key={area.name} value={area.name}>
                          {language === 'en' ? area.name : area.namebn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'en' ? 'Description' : 'বর্ণনা'}
                  </label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={language === 'en' ? 'Enter crime description...' : 'অপরাধের বর্ণনা লিখুন...'}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {language === 'en' ? 'Severity (1-5)' : 'তীব্রতা (১-৫)'}
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      value={formData.severity}
                      onChange={(e) => setFormData({ ...formData, severity: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {language === 'en' ? 'Victims' : 'ভিকটিম'}
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.victims}
                      onChange={(e) => setFormData({ ...formData, victims: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700">
                    {editingCrime 
                      ? (language === 'en' ? 'Update' : 'আপডেট')
                      : (language === 'en' ? 'Add' : 'যোগ করুন')
                    }
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingCrime(null);
                    }}
                    className="flex-1"
                  >
                    {language === 'en' ? 'Cancel' : 'বাতিল'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Crime Records Table */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-semibold">
              {language === 'en' ? 'Recent Crime Records' : 'সাম্প্রতিক অপরাধ রেকর্ড'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'en' ? 'Type' : 'ধরন'}</TableHead>
                  <TableHead>{language === 'en' ? 'Area' : 'এলাকা'}</TableHead>
                  <TableHead>{language === 'en' ? 'Date' : 'তারিখ'}</TableHead>
                  <TableHead>{language === 'en' ? 'Severity' : 'তীব্রতা'}</TableHead>
                  <TableHead>{language === 'en' ? 'Status' : 'স্ট্যাটাস'}</TableHead>
                  <TableHead className="text-right">{language === 'en' ? 'Actions' : 'পদক্ষেপ'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crimes.slice(0, 20).map((crime) => (
                  <TableRow key={crime.id}>
                    <TableCell className="font-medium">{crime.typeName}</TableCell>
                    <TableCell>{crime.area}</TableCell>
                    <TableCell>{new Date(crime.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={crime.severity >= 4 ? 'destructive' : 'secondary'}>
                        {crime.severity}/5
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{crime.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(crime)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(crime.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}